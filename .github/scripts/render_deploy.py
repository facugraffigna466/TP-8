#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request


GRAPHQL_ENDPOINT = "https://api.render.com/graphql"


def render_request(token: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        GRAPHQL_ENDPOINT,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        print(f"[render-deploy] HTTPError {exc.code}", file=sys.stderr)
        print(exc.read().decode("utf-8"), file=sys.stderr)
        raise
    except urllib.error.URLError as exc:
        print(f"[render-deploy] URLError: {exc.reason}", file=sys.stderr)
        raise
    return json.loads(body)


def deploy_service(token: str, service_id: str, image: str) -> dict:
    payload = {
        "query": """
        mutation DeployService($serviceId: ID!, $imagePath: String!) {
          deployService(input: {
            serviceId: $serviceId,
            imagePath: $imagePath,
            clearCache: false
          }) {
            id
            status
          }
        }
        """,
        "variables": {
            "serviceId": service_id,
            "imagePath": image,
        },
    }
    return render_request(token, payload)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Trigger a Render deployService call.")
    parser.add_argument("--service-id", required=True, help="Render service identifier")
    parser.add_argument("--image", required=True, help="Container image path to deploy")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    token = os.environ.get("RENDER_API_TOKEN")
    if not token:
        print("[render-deploy] Missing environment variable RENDER_API_TOKEN", file=sys.stderr)
        return 1

    print(f"[render-deploy] Deploying image '{args.image}' to service '{args.service_id}'")
    try:
        response = deploy_service(token, args.service_id, args.image)
    except Exception as exc:
        print(f"[render-deploy] Request failed: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(response, indent=2))
    errors = response.get("errors", [])
    if errors:
        print("[render-deploy] Render returned errors", file=sys.stderr)
        return 1

    status = response.get("data", {}).get("deployService", {}).get("status")
    print(f"[render-deploy] Deployment triggered. Initial status: {status}")

    return 0


if __name__ == "__main__":
    sys.exit(main())

