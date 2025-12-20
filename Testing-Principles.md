# Universal Testing Principles – Agent Runbook

## Purpose

This document defines **non-negotiable testing principles** that apply to **all development work**, regardless of feature, layer, or technology.

It exists to:

* Prevent regressions
* Expose edge cases early
* Separate “it works on my machine” from **production-grade confidence**
* Force work to a clear, auditable definition of **DONE**

This document is **always used as context** when generating or executing a testing plan.

---

## Golden Rule

> **If it changed behaviour, it must be tested.**

Refactors, optimisations, “small tweaks”, config changes, and “just plumbing” are not exempt.

---

## 1. Testing Is a Required Phase, Not a Courtesy

Every meaningful unit of work **must end with testing**.

A unit of work can be:

* A feature
* A bug fix
* A refactor
* A migration
* A performance change
* An infrastructure or config change
* A logic rewrite

No testing = work incomplete.

---

## 2. Tests Must Be Explicit and Atomic

Testing plans must be broken into **atomic checks**.

Each test must:

* Verify **one thing**
* Have clear steps
* Have a binary outcome: **Pass / Fail**
* Be independently repeatable

Avoid vague tests.

❌ “Check the system works”
✅ “POST /api/x returns 400 when y is missing”

---

## 3. Always Test at the Right Level(s)

For each change, identify **which layers are affected**, and test accordingly:

* **Backend logic** (pure logic, validation, calculations)
* **API contracts** (inputs, outputs, status codes)
* **Persistence** (writes, reads, migrations, defaults)
* **UI behaviour** (rendering, state, interaction)
* **System behaviour** (crons, queues, background jobs)
* **Infrastructure assumptions** (startup order, readiness, retries)

If multiple layers are touched, **multiple layers must be tested**.

---

## 4. Happy Path First, Always

Every testing plan starts with:

1. The intended / ideal flow
2. Confirmation it works exactly as designed

If the happy path fails:

* Stop
* Fix
* Restart testing

Do not continue into edge cases on a broken base.

---

## 5. Negative Testing Is Mandatory

Every testing plan **must include failure scenarios**.

Examples (non-exhaustive):

* Missing required inputs
* Invalid types
* Invalid states
* Out-of-order operations
* Duplicate submissions
* Unexpected nulls / empties
* Conflicting configuration
* Partial saves

Assume users, APIs, and systems **will misuse things**.

---

## 6. Persistence Must Be Proven, Not Assumed

Any data that is:

* Saved
* Updated
* Migrated
* Derived
* Cached

Must be tested by:

1. Writing it
2. Reloading / re-fetching
3. Verifying it is **exactly correct**

If persistence is involved, **reload is mandatory**.

---

## 7. State Transitions Must Be Tested Explicitly

If something can move between states (e.g. draft → active → archived):

Test:

* Each valid transition
* Each invalid transition
* Behaviour at boundaries

State bugs are subtle and expensive — treat them aggressively.

---

## 8. Regression Testing Is Not Optional

Every testing plan must include a **minimal regression pack**, covering:

* One representative existing flow
* One representative existing record
* One previously working feature adjacent to the change

Regression packs should be **small and fast**, but always run.

---

## 9. Infrastructure & Environment Are Part of the System

Testing must respect:

* Startup readiness
* External dependencies
* Proxy / network behaviour
* Timing issues
* Concurrency
* Retries and timeouts

Tests must **not** conflate:

* Infrastructure instability
  with
* Application correctness

If infra is unstable, tests are **blocked**, not failed.

---

## 10. Performance Expectations Must Be Checked When Relevant

If work affects:

* Queries
* Loops
* Rendering
* Background jobs
* Payload size

Then tests must include:

* At least one **performance sanity check**
* Explicit acknowledgment if performance was *not* evaluated

Silence is not acceptance.

---

## 11. No Silent Failures

Tests must confirm that:

* Errors are surfaced
* Logs are written where expected
* Failures do not disappear silently
* Partial failures do not corrupt state

A “quiet failure” is worse than a crash.

---

## 12. Tests Must Be Executed, Not Just Written

A testing plan is only complete when:

* Each test has Pass / Fail
* Failures include notes or reproduction steps
* Blockers are explicitly marked

A plan without execution is documentation, not QA.

---

## 13. Fix → Re-Test → Regress

When a failure is found:

1. Fix the issue
2. Re-run the failing test(s)
3. Re-run the minimal regression pack

Skipping re-tests is how regressions breed.

## 14. Atomic Testing Principle (Non-Negotiable)
Definition

All testing must be performed at the smallest meaningful unit of behaviour.

An atomic test verifies one action, one rule, or one state transition and nothing else.

If a test checks more than one thing, it is not atomic and must be split.

What “Atomic” Means in Practice

Each atomic test must answer exactly one question, for example:

Does this function return the correct value for this input?

Does this validation rule trigger when this field is empty?

Does this API reject an invalid payload?

Does this UI control toggle state correctly?

Does this flag change behaviour when flipped?

Not:

“Does the form work?”

“Does saving behave correctly?”

“Does the wizard function end-to-end?”

Those are composed tests, which are built from atomic tests — never instead of them.

Atomic Test Structure (Required)

Every test in a testing plan must map to this structure:

Setup – minimal preconditions

Action – single user or system action

Assertion – single expected outcome

Isolation – no reliance on side effects from other tests

If any step depends on:

previous tests

multiple outcomes

implied behaviour

→ the test must be split.

Examples
❌ Non-Atomic (Bad)

“Create a task, add fields, save it, reopen it, and submit it successfully.”

This hides multiple failure points.

✅ Atomic (Good)

Create task → task record exists

Add field → field appears in builder

Save task → API returns 200

Reload task → field persists

Submit task → validation passes

Submit without required field → validation fails

Each failure is immediately diagnosable.

Atomic Coverage Expectations

For every change, atomic tests must cover:

Creation

Update

Deletion (or prevention of deletion)

Validation (positive and negative)

Persistence

Error handling

Boundary conditions

Skipping any of these requires explicit justification.

Relationship to Higher-Level Tests

Atomic tests come first.

## 15. Definition of DONE

Work is considered **DONE** only when:

* All planned tests pass
  **OR**
* Failures are documented, understood, and explicitly deferred

“Looks fine” is not a state.
“Agent thinks it’s okay” is not a signal.

---

## Instruction to Agent

When asked to:

* Create a testing plan
* Execute testing
* Validate a change

You must:

* Apply these principles universally
* Be explicit, not clever
* Prefer over-testing to under-testing
* Assume no context unless stated

Your job is not to confirm correctness.
Your job is to **try to prove it wrong**.
