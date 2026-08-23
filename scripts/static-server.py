#!/usr/bin/env python3
"""
Static file server for the published build.

Deliberately minimal: the app is a hash-routed SPA, so every URL path either
names a real file or is "/", and no rewrite rules are needed. Threaded so one
slow media read does not block the page.
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # index.html must never be cached: the asset filenames inside it change
        # with every build, and a cached copy pins the browser to an old one.
        if self.path in ("/", "/index.html"):
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        elif "/assets/" in self.path:
            # Fingerprinted: safe to cache hard.
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


def main():
    root = sys.argv[1]
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 4190
    os.chdir(root)
    server = ThreadingHTTPServer(("0.0.0.0", port), partial(Handler, directory=root))
    sys.stderr.write("serving %s on 0.0.0.0:%d\n" % (root, port))
    server.serve_forever()


if __name__ == "__main__":
    main()
