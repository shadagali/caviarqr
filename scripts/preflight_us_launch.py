#!/usr/bin/env python3
"""
CaviarQR US production code preflight.

Usage from the project root:
    python scripts\preflight_us_launch.py C:\sanjithnfcbarcode

This script does not change files or databases.
It only inspects the repository for launch-critical configuration.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path


IGNORED_DIRS = {
    ".git",
    ".next",
    "node_modules",
    "dist",
    "build",
    ".caviarqr-backups",
    "coverage",
}


class Reporter:
    def __init__(self) -> None:
        self.passes = 0
        self.warns = 0
        self.fails = 0

    def ok(self, message: str) -> None:
        self.passes += 1
        print(f"[PASS] {message}")

    def warn(self, message: str) -> None:
        self.warns += 1
        print(f"[WARN] {message}")

    def fail(self, message: str) -> None:
        self.fails += 1
        print(f"[FAIL] {message}")

    def summary(self) -> int:
        print()
        print("=" * 72)
        print(
            f"Preflight summary: {self.passes} passed, "
            f"{self.warns} warnings, {self.fails} failed"
        )
        if self.fails:
            print("RESULT: CODE PREFLIGHT FAILED")
            return 1
        print("RESULT: CODE PREFLIGHT PASSED")
        return 0


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="ignore")


def require_file(reporter: Reporter, path: Path, label: str) -> bool:
    if path.is_file():
        reporter.ok(f"{label}: {path}")
        return True
    reporter.fail(f"Missing {label}: {path}")
    return False


def check_json_script(
    reporter: Reporter,
    package_json: dict,
    script_name: str,
) -> None:
    scripts = package_json.get("scripts") or {}
    if script_name in scripts:
        reporter.ok(f"backend package.json has script '{script_name}'")
    else:
        reporter.fail(f"backend package.json is missing script '{script_name}'")


def iter_source_files(root: Path):
    allowed_suffixes = {
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".json",
        ".yml",
        ".yaml",
        ".sh",
        ".ps1",
        ".md",
    }

    for current_root, dirs, files in os.walk(root):
        dirs[:] = [
            d for d in dirs
            if d not in IGNORED_DIRS
        ]

        current = Path(current_root)

        for filename in files:
            path = current / filename

            if path.suffix.lower() not in allowed_suffixes:
                continue

            # Do not inspect generated backup/dump artifacts.
            lower_name = path.name.lower()
            if lower_name.endswith((".dump", ".bak")):
                continue

            yield path


def git_tracked_files(root: Path) -> set[str] | None:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), "ls-files"],
            capture_output=True,
            text=True,
            check=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return None

    return {
        line.strip().replace("\\", "/")
        for line in result.stdout.splitlines()
        if line.strip()
    }


def main() -> int:
    project_root = (
        Path(sys.argv[1]).expanduser().resolve()
        if len(sys.argv) > 1
        else Path.cwd().resolve()
    )

    backend = project_root / "backend"
    web = project_root / "web"

    reporter = Reporter()

    print("=" * 72)
    print("CaviarQR US Production Code Preflight")
    print(f"Project root: {project_root}")
    print("=" * 72)
    print()

    if not project_root.is_dir():
        reporter.fail(f"Project root does not exist: {project_root}")
        return reporter.summary()

    backend_package_path = backend / "package.json"
    web_package_path = web / "package.json"
    app_module_path = backend / "src" / "app.module.ts"
    data_source_path = backend / "src" / "database" / "data-source.ts"
    main_path = backend / "src" / "main.ts"
    migration_dir = backend / "src" / "migrations"

    have_backend_package = require_file(
        reporter, backend_package_path, "backend/package.json"
    )
    require_file(reporter, web_package_path, "web/package.json")
    have_app_module = require_file(
        reporter, app_module_path, "backend/src/app.module.ts"
    )
    have_data_source = require_file(
        reporter, data_source_path, "backend/src/database/data-source.ts"
    )
    have_main = require_file(
        reporter, main_path, "backend/src/main.ts"
    )

    print()

    backend_package = {}
    if have_backend_package:
        try:
            backend_package = json.loads(read_text(backend_package_path))
            reporter.ok("backend/package.json is valid JSON")
        except json.JSONDecodeError as exc:
            reporter.fail(f"backend/package.json is invalid JSON: {exc}")

    if backend_package:
        for script_name in (
            "build",
            "migration:show",
            "migration:run",
            "migration:revert",
        ):
            check_json_script(reporter, backend_package, script_name)

        dependencies = {}
        dependencies.update(backend_package.get("dependencies") or {})
        dependencies.update(backend_package.get("devDependencies") or {})

        if "typeorm" in dependencies:
            reporter.ok("TypeORM dependency is present")
        else:
            reporter.fail("TypeORM dependency is missing")

        if "dotenv" in dependencies:
            reporter.ok("dotenv dependency is present for migration CLI env loading")
        else:
            reporter.warn(
                "dotenv is not listed; migration CLI may not load backend/.env"
            )

    print()

    if have_app_module:
        app_module = read_text(app_module_path)

        if re.search(r"\bsynchronize\s*:\s*false\b", app_module):
            reporter.ok("AppModule disables TypeORM synchronize")
        else:
            reporter.fail(
                "AppModule must explicitly use synchronize: false"
            )

        if re.search(r"\bmigrationsRun\s*:\s*false\b", app_module):
            reporter.ok("AppModule disables automatic migration execution")
        else:
            reporter.fail(
                "AppModule must explicitly use migrationsRun: false"
            )

        if re.search(r"\bsynchronize\s*:\s*true\b", app_module):
            reporter.fail(
                "Unsafe synchronize: true found in AppModule"
            )

        if re.search(r"\bmigrationsRun\s*:\s*true\b", app_module):
            reporter.fail(
                "Unsafe migrationsRun: true found in AppModule"
            )

        required_db_envs = (
            "DB_HOST",
            "DB_PORT",
            "DB_USERNAME",
            "DB_PASSWORD",
            "DB_NAME",
        )
        missing = [name for name in required_db_envs if name not in app_module]
        if not missing:
            reporter.ok(
                "AppModule references required production database environment variables"
            )
        else:
            reporter.fail(
                "AppModule is missing production DB env references: "
                + ", ".join(missing)
            )

        if "DB_SSL" in app_module:
            reporter.ok("AppModule contains production DB SSL configuration")
        else:
            reporter.warn(
                "Could not find DB_SSL handling in AppModule"
            )

    if have_data_source:
        data_source = read_text(data_source_path)

        if re.search(r"\bsynchronize\s*:\s*false\b", data_source):
            reporter.ok("Migration DataSource disables synchronize")
        else:
            reporter.fail(
                "Migration DataSource must explicitly use synchronize: false"
            )

        if re.search(r"\bmigrationsRun\s*:\s*false\b", data_source):
            reporter.ok("Migration DataSource disables automatic migrations")
        else:
            reporter.fail(
                "Migration DataSource must explicitly use migrationsRun: false"
            )

        if "migrations" in data_source and "join(" in data_source:
            reporter.ok("Migration DataSource configures migration discovery")
        else:
            reporter.fail(
                "Migration DataSource does not appear to configure migrations"
            )

    if migration_dir.is_dir():
        migrations = sorted(
            list(migration_dir.glob("*.ts")) +
            list(migration_dir.glob("*.js"))
        )
        if migrations:
            reporter.ok(
                f"Found {len(migrations)} migration file(s) in {migration_dir}"
            )
            for migration in migrations:
                print(f"       - {migration.name}")
        else:
            reporter.fail(
                f"No migration files found in {migration_dir}"
            )
    else:
        reporter.fail(f"Migration directory is missing: {migration_dir}")

    print()

    if have_main:
        main_text = read_text(main_path)

        if "rawBody" in main_text or "raw-body" in main_text:
            reporter.ok(
                "main.ts appears to preserve raw request bodies for Stripe webhook verification"
            )
        else:
            reporter.warn(
                "Could not confirm raw-body preservation in main.ts; "
                "Stripe webhook signatures must be verified against the raw body"
            )

        if ".enableCors" in main_text or "enableCors(" in main_text:
            reporter.ok("CORS configuration is present in main.ts")
        else:
            reporter.warn("Could not find CORS configuration in main.ts")

        if re.search(
            r"origin\s*:\s*['\"]\*['\"]",
            main_text,
            flags=re.IGNORECASE,
        ):
            reporter.fail(
                "Wildcard production CORS origin found in main.ts"
            )

    print()

    tracked = git_tracked_files(project_root)
    sensitive_env_paths = {
        ".env",
        "backend/.env",
        "web/.env",
        "web/.env.local",
        "web/.env.production",
        "backend/.env.production",
    }

    if tracked is None:
        reporter.warn(
            "Could not inspect git-tracked files; verify .env files are not committed"
        )
    else:
        exposed = sorted(sensitive_env_paths.intersection(tracked))
        if exposed:
            reporter.fail(
                "Sensitive env file(s) are tracked by git: "
                + ", ".join(exposed)
            )
        else:
            reporter.ok("No common secret .env files are tracked by git")

    secret_patterns = {
        "Stripe live secret key": re.compile(r"\bsk_live_[A-Za-z0-9]+"),
        "Stripe restricted live key": re.compile(r"\brk_live_[A-Za-z0-9]+"),
        "Stripe webhook signing secret": re.compile(r"\bwhsec_[A-Za-z0-9]+"),
    }

    secret_hits: list[tuple[str, Path]] = []

    for source_path in iter_source_files(project_root):
        # Local .env files are intentionally excluded from source-code scanning.
        if source_path.name.startswith(".env"):
            continue

        try:
            text = read_text(source_path)
        except OSError:
            continue

        for label, pattern in secret_patterns.items():
            if pattern.search(text):
                secret_hits.append((label, source_path))

    if secret_hits:
        for label, path in secret_hits[:20]:
            reporter.fail(
                f"{label} appears committed/in source: "
                f"{path.relative_to(project_root)}"
            )
        if len(secret_hits) > 20:
            reporter.fail(
                f"{len(secret_hits) - 20} additional possible secret hit(s) found"
            )
    else:
        reporter.ok(
            "No obvious Stripe live secrets found in repository source files"
        )

    print()

    web_env_usage_found = False
    for candidate in (
        web / "src",
        web / "app",
        web / "lib",
    ):
        if not candidate.exists():
            continue
        for source_path in iter_source_files(candidate):
            try:
                if "NEXT_PUBLIC_API_URL" in read_text(source_path):
                    web_env_usage_found = True
                    break
            except OSError:
                pass
        if web_env_usage_found:
            break

    if web_env_usage_found:
        reporter.ok(
            "Frontend references NEXT_PUBLIC_API_URL for backend routing"
        )
    else:
        reporter.warn(
            "Could not find NEXT_PUBLIC_API_URL usage in frontend source"
        )

    print()
    print("Manual launch gates still required after this script passes:")
    print("  1. Run backend and frontend production builds.")
    print("  2. Run migrations against the target RDS database.")
    print("  3. Verify HTTPS, CORS, Stripe webhook endpoint and signing secret.")
    print("  4. Complete one real low-value US/USD order end-to-end.")
    print("  5. Verify exactly one Order, kitchen delivery, analytics and refund.")
    print("  6. Verify tenant isolation with two separate cafe accounts.")
    print()

    return reporter.summary()


if __name__ == "__main__":
    raise SystemExit(main())