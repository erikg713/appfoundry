"""
app.(dashboard).organizations

Package containing organization-related server-side helpers.

This file intentionally keeps imports lazy and resilient so importing the package
doesn't force expensive dependencies (DB drivers, ORMs) to be loaded at import time.

Replace or extend the re-exports below with actual submodule names (e.g. models, crud, schemas).
"""

from importlib import import_module
from typing import Any, Optional

__all__ = [
    "Organization",
    "get_organization",
    "create_organization",
    "OrganizationNotFoundError",
]

__version__ = "0.0.1"
__author__ = "Your Name <you@example.com>"

def _try_import(module_name: str, attr: str) -> Optional[Any]:
    """
    Try to import `attr` from `module_name`. Return None on failure.
    This prevents import-time errors in environments that don't have optional deps.
    """
    try:
        mod = import_module(f"{__name__}.{module_name}")
        return getattr(mod, attr)
    except Exception:
        return None

# Re-export commonly used names if the submodules are present.
Organization = _try_import("models", "Organization")
get_organization = _try_import("crud", "get_organization")
create_organization = _try_import("crud", "create_organization")
OrganizationNotFoundError = _try_import("exceptions", "OrganizationNotFoundError")

# Helpful runtime check for users who import the package but expect the APIs to be present.
def require(name: str):
    """
    Raise a clear error if a re-export is not available.
    Example: require('Organization') -> raises RuntimeError if Organization is None.
    """
    val = globals().get(name)
    if val is None:
        raise RuntimeError(
            f"{name!r} is not available in {__name__}. Did you install optional Python "
            "dependencies or run the code generation step that defines the submodules?"
        )
    return val
