#!/usr/bin/env python3
"""Dispatch and monitor the four-repository AWS stack through GitHub CLI."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any


OWNER = "Async-And-Furious"


@dataclass(frozen=True)
class Step:
    repository: str
    workflow: str
    inputs: dict[str, str]


def gh(arguments: list[str], *, json_output: bool = False) -> Any:
    command = ["gh", *arguments]
    result = subprocess.run(command, check=False, text=True, capture_output=True)
    if result.stdout and not json_output:
        print(result.stdout, end="")
    if result.returncode:
        detail = result.stderr.strip() or "no error details"
        raise RuntimeError(f"gh failed ({' '.join(command)}): {detail}")
    if json_output:
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError as error:
            raise RuntimeError(f"gh returned invalid JSON for {' '.join(command)}") from error
    return None


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def find_run(repository: str, workflow: str, ref: str, dispatch_at: datetime) -> dict[str, Any]:
    runs = gh(
        [
            "run",
            "list",
            "--repo",
            repository,
            "--workflow",
            workflow,
            "--event",
            "workflow_dispatch",
            "--limit",
            "20",
            "--json",
            "databaseId,url,status,conclusion,createdAt,headBranch,event",
        ],
        json_output=True,
    )
    candidates = [
        run
        for run in runs
        if run.get("event") == "workflow_dispatch"
        and run.get("headBranch") == ref
        and parse_time(run["createdAt"]) >= dispatch_at - timedelta(seconds=5)
    ]
    if not candidates:
        raise RuntimeError(f"Could not identify the dispatched run for {repository}:{workflow} on {ref}.")
    return max(candidates, key=lambda run: parse_time(run["createdAt"]))


def dispatch_and_wait(step: Step, environment: str, action: str, ref: str, poll_seconds: int) -> None:
    repository = f"{OWNER}/{step.repository}"
    dispatch_at = datetime.now(timezone.utc)
    arguments = ["workflow", "run", step.workflow, "--repo", repository, "--ref", ref]
    for key, value in step.inputs.items():
        arguments.extend(["--field", f"{key}={value}"])
    print(f"Dispatching {repository}:{step.workflow} ({environment}, {action}) on {ref}")
    gh(arguments)

    run: dict[str, Any] | None = None
    while run is None:
        time.sleep(poll_seconds)
        try:
            run = find_run(repository, step.workflow, ref, dispatch_at)
        except RuntimeError as error:
            if "Could not identify" not in str(error):
                raise
    print(f"Run: {run['url']}")

    while True:
        current = gh(
            ["run", "view", str(run["databaseId"]), "--repo", repository, "--json", "status,conclusion,url"],
            json_output=True,
        )
        print(f"  status={current['status']}")
        if current["status"] == "completed":
            print(f"  conclusion={current.get('conclusion')}")
            if current.get("conclusion") != "success":
                raise RuntimeError(
                    f"{repository}:{step.workflow} failed with conclusion "
                    f"'{current.get('conclusion')}'. See {current.get('url', run['url'])}"
                )
            return
        time.sleep(poll_seconds)


def steps_for(environment: str, action: str, app_ref: str, confirmation: str) -> list[Step]:
    apply_confirmation = "APPLY PROD" if environment == "prod" else ""
    if action == "apply":
        return [
            Step("repo-k8s-infra", "ci.yml", {"environment": environment, "action": "apply", "academy_mode": "false", "confirm": apply_confirmation}),
            Step("repo-db-infra", "ci.yml", {"environment": environment, "action": "apply", "academy_mode": "false", "confirm": apply_confirmation}),
            Step("repo-auth-serverless", "ci.yml", {"environment": environment, "operation": "apply", "deploy_auth_only": "false", "confirm": apply_confirmation}),
            Step("async-furious-project", "deploy-eks.yml", {"environment": environment, "seed_prod": "false"}),
        ]
    return [
        Step("async-furious-project", "cleanup-eks.yml", {"environment": environment, "aws_academy": "false", "operation": "destroy", "confirm": confirmation}),
        Step("repo-auth-serverless", "down.yml", {"environment": environment, "confirm": confirmation}),
        Step("repo-db-infra", "down.yml", {"environment": environment, "confirm": confirmation}),
        Step("repo-k8s-infra", "down.yml", {"environment": environment, "confirm": confirmation}),
    ]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--environment",
        choices=("hml", "prod"),
        help="target environment (default: hml; conflicts with --prod when set to hml)",
    )
    parser.add_argument("--prod", action="store_true", help="select the production environment")
    parser.add_argument("--action", required=True, choices=("apply", "destroy"))
    parser.add_argument("--confirmation", default="")
    parser.add_argument("--app-ref", choices=("develop", "main"))
    parser.add_argument("--poll-seconds", type=int, default=10)
    parser.add_argument("--what-if", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.prod and args.environment == "hml":
        raise SystemExit("Conflicting environment flags: --prod cannot be combined with --environment hml.")
    environment = "prod" if args.prod else (args.environment or "hml")
    if not 5 <= args.poll_seconds <= 300:
        raise SystemExit("--poll-seconds must be between 5 and 300")
    expected = f"DESTROY {environment.upper()}"
    if args.action == "destroy" and args.confirmation != expected:
        raise SystemExit(f"Destroy requires exact --confirmation '{expected}'.")
    app_ref = args.app_ref or ("develop" if environment == "hml" else "main")
    steps = steps_for(environment, args.action, app_ref, args.confirmation)

    if shutil.which("gh") is None:
        raise SystemExit("GitHub CLI (gh) is not installed or is not on PATH.")
    gh(["auth", "status"])
    for step in steps:
        ref = app_ref if step.repository == "async-furious-project" else "main"
        if args.what_if:
            inputs = ", ".join(f"{key}={value}" for key, value in step.inputs.items())
            print(f"WhatIf: would dispatch {step.repository}/{step.workflow} on {ref} with inputs: {inputs}")
        else:
            dispatch_and_wait(step, environment, args.action, ref, args.poll_seconds)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, KeyboardInterrupt) as error:
        print(f"Error: {error}", file=sys.stderr)
        raise SystemExit(1) from error
