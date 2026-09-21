#!/usr/bin/python3
import importlib.util
import unittest
from pathlib import Path


def load_helper():
    path = Path(__file__).resolve().with_name("state-io.py")
    spec = importlib.util.spec_from_file_location("state_io", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class FetchRequestTest(unittest.TestCase):
    def test_fetch_sends_a_named_user_agent(self):
        io = load_helper()
        req = io.fetch_request("https://get.geojs.io/v1/ip/geo.json")
        headers = {key.lower(): value for key, value in req.header_items()}
        self.assertEqual(headers.get("user-agent"), "Omarain/1.0")


if __name__ == "__main__":
    unittest.main()
