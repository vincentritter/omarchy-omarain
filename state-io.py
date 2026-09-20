#!/usr/bin/python3 -I
import json
import os
import pwd
import re
import select
import ssl
import stat
import sys
import urllib.request
from urllib.parse import urlparse

MAX_BYTES = 65536
MAX_TILT = 256
_COMPONENT = re.compile(r"[A-Za-z0-9._-]+")
ALLOWED_FETCH = {
    "api.open-meteo.com",
    "geocoding-api.open-meteo.com",
    "get.geojs.io",
}
FILE_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}")


def _ok_component(name):
    return bool(_COMPONENT.fullmatch(name)) and name not in (".", "..")


def open_dir_chain(parts, tighten_leaf=False, create=True):
    if not parts or not all(_ok_component(p) for p in parts):
        raise PermissionError("refusing directory chain")
    home = pwd.getpwuid(os.geteuid()).pw_dir
    fd = os.open(home, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
    try:
        for i, name in enumerate(parts):
            try:
                nfd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=fd)
            except FileNotFoundError:
                if not create:
                    raise
                try:
                    os.mkdir(name, 0o700, dir_fd=fd)
                except FileExistsError:
                    pass
                nfd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=fd)
            os.close(fd)
            fd = nfd
            st = os.fstat(fd)
            if not stat.S_ISDIR(st.st_mode) or st.st_uid != os.geteuid():
                raise PermissionError("untrusted directory component %s" % name)
            if tighten_leaf and i == len(parts) - 1 and st.st_mode & 0o077:
                os.fchmod(fd, 0o700)
        return fd
    except BaseException:
        os.close(fd)
        raise


def read_bounded(dirfd, name, require_private=True):
    try:
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC, dir_fd=dirfd)
    except FileNotFoundError:
        return None
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or st.st_uid != os.geteuid() or st.st_nlink != 1:
            raise PermissionError("refusing state file")
        if require_private and st.st_mode & 0o077:
            raise PermissionError("refusing world-accessible state file")
        if (not require_private) and st.st_mode & 0o022:
            raise PermissionError("refusing group-writable location file")
        if st.st_size > MAX_BYTES:
            raise PermissionError("state file too large")
        os.set_blocking(fd, True)
        data = b""
        while len(data) <= MAX_BYTES:
            chunk = os.read(fd, min(65536, MAX_BYTES + 1 - len(data)))
            if not chunk:
                break
            data += chunk
        if len(data) > MAX_BYTES:
            raise PermissionError("state file grew past the limit")
        return data
    finally:
        os.close(fd)


def write_atomic(dirfd, name, data):
    if len(data) > MAX_BYTES:
        raise ValueError("payload too large")
    tmp = ".%s.%s.tmp" % (name, os.urandom(8).hex())
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=dirfd)
    try:
        os.fchmod(fd, 0o600)
        view = memoryview(data)
        while view:
            n = os.write(fd, view)
            view = view[n:]
        os.fsync(fd)
        os.rename(tmp, name, src_dir_fd=dirfd, dst_dir_fd=dirfd)
        os.fsync(dirfd)
    except BaseException:
        try:
            os.unlink(tmp, dir_fd=dirfd)
        except OSError:
            pass
        raise
    finally:
        os.close(fd)


def read_stdin():
    data = b""
    while len(data) <= MAX_BYTES:
        ready, _, _ = select.select([sys.stdin.buffer], [], [], 2)
        if not ready:
            break
        chunk = os.read(sys.stdin.fileno(), min(4096, MAX_BYTES + 1 - len(data)))
        if not chunk:
            break
        data += chunk
    if len(data) > MAX_BYTES:
        raise PermissionError("payload too large")
    return data


class SameHostRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        old = urlparse(req.full_url)
        new = urlparse(newurl)
        if new.scheme != "https" or (new.hostname or "").lower() != (old.hostname or "").lower():
            return None
        if new.port not in (None, 443):
            return None
        return urllib.request.HTTPRedirectHandler.redirect_request(
            self, req, fp, code, msg, headers, newurl
        )


def fetch(url):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.username or parsed.password:
        raise PermissionError("refusing url")
    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_FETCH:
        raise PermissionError("refusing host")
    if parsed.port not in (None, 443):
        raise PermissionError("refusing port")
    req = urllib.request.Request(url, method="GET")
    ctx = ssl.create_default_context()
    opener = urllib.request.build_opener(
        SameHostRedirect,
        urllib.request.ProxyHandler({}),
        urllib.request.HTTPSHandler(context=ctx),
    )
    with opener.open(req, timeout=8) as resp:
        data = resp.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise PermissionError("response too large")
    json.loads(data.decode("utf-8", "strict"))
    return data


def read_sys_file(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC)
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode):
            raise PermissionError("refusing sysfs node")
        os.set_blocking(fd, True)
        return os.read(fd, MAX_TILT)
    finally:
        os.close(fd)


def tilt():
    try:
        devices = os.listdir("/sys/bus/iio/devices")
    except OSError:
        devices = []
    for name in devices:
        if not name.startswith("iio:device"):
            continue
        base = "/sys/bus/iio/devices/" + name
        try:
            xr = read_sys_file(base + "/in_accel_x_raw")
            yr = read_sys_file(base + "/in_accel_y_raw")
            zr = read_sys_file(base + "/in_accel_z_raw")
        except OSError:
            continue
        if not (xr and yr and zr):
            continue
        def scale(axis):
            try:
                raw = read_sys_file(base + "/in_accel_%s_scale" % axis)
                if raw:
                    return raw
            except OSError:
                pass
            try:
                return read_sys_file(base + "/in_accel_scale")
            except OSError:
                return b"1"
        sx, sy, sz = scale("x"), scale("y"), scale("z")
        sys.stdout.write("%.4f %.4f %.4f\n" % (
            float(xr) * float(sx or 1),
            float(yr) * float(sy or 1),
            float(zr) * float(sz or 1),
        ))
        return
    try:
        platforms = os.listdir("/sys/devices/platform")
    except OSError:
        platforms = []
    for name in platforms:
        if not name.startswith("applesmc."):
            continue
        try:
            raw = read_sys_file("/sys/devices/platform/" + name + "/position")
        except OSError:
            continue
        text = raw.decode("utf-8", "replace").replace("(", "").replace(")", "")
        parts = [p.strip() for p in text.split(",")]
        if len(parts) < 3:
            continue
        g = 256.0
        sys.stdout.write("%.4f %.4f %.4f\n" % (
            float(parts[0]) / g * 9.81,
            float(parts[1]) / g * 9.81,
            float(parts[2]) / g * 9.81,
        ))
        return
    sys.exit(1)


def main():
    if len(sys.argv) < 2:
        sys.exit(2)
    op = sys.argv[1]
    if op == "read":
        if len(sys.argv) < 3 or not FILE_NAME.fullmatch(sys.argv[2]):
            sys.exit(2)
        dirfd = open_dir_chain([".local", "state", "omarchy"], tighten_leaf=False)
        try:
            raw = read_bounded(dirfd, sys.argv[2], require_private=False)
            sys.stdout.write(raw.decode("utf-8", "strict") if raw else "")
        finally:
            os.close(dirfd)
        return
    if op == "write":
        if len(sys.argv) < 3 or not FILE_NAME.fullmatch(sys.argv[2]):
            sys.exit(2)
        payload = read_stdin()
        json.loads(payload.decode("utf-8", "strict"))
        dirfd = open_dir_chain([".local", "state", "omarchy"], tighten_leaf=False)
        try:
            write_atomic(dirfd, sys.argv[2], payload)
        finally:
            os.close(dirfd)
        return
    if op == "read-weather":
        try:
            dirfd = open_dir_chain([".local", "state", "omarchy", "settings"], tighten_leaf=False, create=False)
        except FileNotFoundError:
            return
        try:
            raw = read_bounded(dirfd, "weather.json", require_private=False)
            sys.stdout.write(raw.decode("utf-8", "strict") if raw else "")
        finally:
            os.close(dirfd)
        return
    if op == "fetch":
        url = sys.argv[2] if len(sys.argv) > 2 else ""
        if url == "--" and len(sys.argv) > 3:
            url = sys.argv[3]
        sys.stdout.write(fetch(url).decode("utf-8", "strict"))
        return
    if op == "tilt":
        tilt()
        return
    sys.exit(2)


if __name__ == "__main__":
    try:
        main()
    except (PermissionError, ValueError, json.JSONDecodeError, OSError, ssl.SSLError):
        sys.exit(1)
