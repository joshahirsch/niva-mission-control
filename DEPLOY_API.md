# Deploying the Mission Control private read-only API

This document describes the **approved private** Cloud Run architecture for the
versioned read-only API (`GET /api/v1/delivery` and `GET /api/v1/weekly-report`).
It is documentation only — following this file does not by itself deploy, create
secrets, change IAM, or alter Google Cloud resources.

Do not execute the commands below until a separate, explicit deployment phase
is authorized.

Google Docs, Google Drive, and Cloud Scheduler are **not** part of this source
phase. They are planned downstream consumers of `GET /api/v1/weekly-report`, not
implemented here.

---

## 1. Architecture

Three distinct surfaces:

| Surface | Cloud Run service | Auth | Role |
|---|---|---|---|
| Existing dashboard | `niva-mission-control` | **IAP-protected** (unchanged) | Mission Control UI + internal APIs |
| Private read-only API | `niva-mission-control-api` | **Cloud Run IAM** + application bearer token | Read-only `GET /api/v1/delivery` and `GET /api/v1/weekly-report` |
| Future MCP caller | *(caller identity, not this service)* | Google service-to-service identity + bearer token | Invokes the API; does **not** receive dashboard access merely because it can invoke the API |

### Separation rules

- **`niva-mission-control`** remains the IAP-protected dashboard. Its service,
  IAP configuration, current revision, traffic split, and invoker bindings are
  **outside the API deployment scope**. Do not weaken, replace, bypass, or
  repurpose them for the API.
- **`niva-mission-control-api`** is a **separate** Cloud Run service. It uses
  `MISSION_CONTROL_API_ONLY=true`, receives **no** public dashboard traffic,
  does **not** require IAP, and must **not** allow unauthenticated invocation.
- A future MCP (or other approved caller) authenticates with Google
  service-to-service identity (`roles/run.invoker` on the API service only)
  **and** supplies the application bearer token.

Arbitrary bearer access from ChatGPT still requires a subsequent MCP / custom
connector layer. This API alone is not a ChatGPT connector.

### Approved resource names

| Resource | Value |
|---|---|
| Project | `niva-hr-database` |
| Project number | `502348536731` |
| Region | `us-central1` |
| API Cloud Run service | `niva-mission-control-api` |
| Runtime service account | `niva-mission-control-api-run@niva-hr-database.iam.gserviceaccount.com` |
| Application bearer-token secret | `mission-control-api-token` |
| Reused Trello secret | `trello-token` |
| Reviewed image digest (authoritative deploy input) | `us-central1-docker.pkg.dev/niva-hr-database/niva/niva-mission-control@sha256:2a046c787d49e777113bb01531f777ee8ec6fb2f71a34fed782ca658c33e086e` |
| Human-readable provenance label (not a deploy input) | `us-central1-docker.pkg.dev/niva-hr-database/niva/niva-mission-control:159cbbd` (commit `159cbbd`) |

Artifact Registry tags are **mutable**. Deployment by digest selects the reviewed
bytes even if a tag is later moved. Do **not** call `:159cbbd` immutable. Do
**not** use `:latest` as a deploy image input.

---

## 2. Two independent authentication layers

Both layers are required. Neither alone is sufficient.

### Layer 1 — Cloud Run IAM (transport)

- The API service is deployed with **no unauthenticated invocation**
  (`--no-allow-unauthenticated`).
- Do **not** use `--allow-unauthenticated`.
- Do **not** grant `allUsers` or `allAuthenticatedUsers` the invoker role.
- The caller must present a valid Google **identity token** (OpenID Connect) for
  an identity that has `roles/run.invoker` on `niva-mission-control-api`.
- An OAuth **access** token is **not** interchangeable with an OpenID Connect
  **identity** token.
- A token with the wrong audience should fail at the Cloud Run IAM boundary.
- Without a valid invoker identity, Cloud Run rejects the request **before**
  application code runs.

### Layer 2 — Application bearer token

- After Cloud Run IAM accepts the request, the application validates
  `Authorization: Bearer <token>` against `MISSION_CONTROL_API_TOKEN`
  (from Secret Manager secret `mission-control-api-token`).
- Implemented in `authenticateBearer` (`src/lib/api-auth.ts`): credentials are
  accepted **only** from the `Authorization` header — never query parameters
  or cookies.
- Missing / malformed / wrong token → sanitized `401` + `WWW-Authenticate: Bearer`.
- Missing or unusable server token → fail closed with sanitized `500`.

### Required header arrangement (do not overwrite)

The committed application **always** reads the application token from
`Authorization`. Cloud Run IAM identity tokens must therefore use the
Cloud Run-supported alternate header so the two credentials do not collide:

```http
GET /api/v1/delivery HTTP/1.1
Host: <niva-mission-control-api-host>
X-Serverless-Authorization: Bearer <GOOGLE_IDENTITY_TOKEN>
Authorization: Bearer <MISSION_CONTROL_API_TOKEN>
```

The same dual-header arrangement applies to `GET /api/v1/weekly-report`
(including optional `?asOf=…`).

Rationale (verified against Cloud Run service-to-service auth docs and the
committed `authenticateBearer` implementation):

- Cloud Run accepts the Google identity token in either `Authorization` or
  `X-Serverless-Authorization`.
- When both are present, Cloud Run checks **only** `X-Serverless-Authorization`.
- The application checks **only** `Authorization` for the bearer token.
- Putting the Google identity token in `Authorization` would overwrite or
  displace the application bearer token and break Layer 2.

Callers (including `gcloud` / client libraries that default to `Authorization`
for the identity token) must be configured to send:

- Google identity token → `X-Serverless-Authorization: Bearer …`
- Application token → `Authorization: Bearer …`

Possession of the application bearer token does **not** permit unauthenticated
invocation. Cloud Run IAM still blocks callers without `roles/run.invoker`.

### Identity-token audience (operator and service-to-service)

Unless a custom audience has been **explicitly** configured on the API service,
the identity-token audience must be the **exact HTTPS Cloud Run service URL**
of `niva-mission-control-api` (the URL returned by `gcloud run services describe`,
without a path suffix).

- Operator validation: mint with
  `gcloud auth print-identity-token --audiences="$ApiUrl"` after reading `$ApiUrl`
  from the deployed service (see §11).
- Future MCP callers: mint an identity token for that same receiving API service
  URL (or an explicitly configured custom audience). The MCP runtime identity
  must hold `roles/run.invoker` on `niva-mission-control-api`.

Do not include a real token in this document. Do not invoke the service during
documentation-only phases.

---

## 3. Required execution order

This is the **required** linear procedure for the initial private API deployment.
It is not a bag of independent examples. Dependencies must exist before anything
references them. **No command may reference `mission-control-api-token` before
that secret exists.**

| Step | Action |
|---|---|
| 1 | Verify prerequisites and operator-selected values |
| 2 | Create the dedicated runtime service account |
| 3 | Generate and create `mission-control-api-token` securely |
| 4 | Grant the runtime service account `secretAccessor` on `trello-token` and `mission-control-api-token` |
| 5 | Confirm required non-secret Trello configuration (explanatory; §9 discovers) |
| 6 | Discover dashboard config read-only, then deploy `niva-mission-control-api` by digest |
| 7 | Grant `roles/run.invoker` to approved callers |
| 8 | Acquire a correctly targeted identity token |
| 9 | Run the validation matrix |
| 10 | Record the resulting API revision and configuration |

Detailed commands for each step follow in §§4–13. Do not skip ahead to a later
section until its listed dependencies are satisfied.

---

## 4. Step 1 — Prerequisites and operator-selected values

Confirm before any mutating command:

- Project `niva-hr-database`, region `us-central1`.
- Operator has permission to create the runtime SA, create the secret, grant
  secret IAM, deploy Cloud Run, and grant `roles/run.invoker` on the API only.
- Reviewed image digest (authoritative):

  ```text
  us-central1-docker.pkg.dev/niva-hr-database/niva/niva-mission-control@sha256:2a046c787d49e777113bb01531f777ee8ec6fb2f71a34fed782ca658c33e086e
  ```

- Provenance label only (commit `159cbbd`; **not** a deploy `--image` input):

  ```text
  us-central1-docker.pkg.dev/niva-hr-database/niva/niva-mission-control:159cbbd
  ```

- Do **not** rebuild the image.
- Do **not** use `:latest` as the image input.
- Caller identities for step 7 are **explicitly approved** (not placeholders).
- Dashboard non-secret Trello env values are discovered read-only inside the §9
  fresh-session deploy procedure (do not print secret values; do not paste
  discovered values from elsewhere into §9).
- Python 3 with **PyYAML** available on PATH (`python` resolves to an
  executable whose major version is 3; that same resolved executable imports
  `yaml`). Required by the §9 `--env-vars-file` serializer. Verify read-only
  before any mutating command. Do **not** install packages during a
  documentation-only phase.

Read-only Python / PyYAML precheck (run before mutation; fail closed):

```powershell
$PythonCommand = Get-Command python -ErrorAction Stop
$PythonExe = $PythonCommand.Source
if ([string]::IsNullOrWhiteSpace($PythonExe)) {
  throw "python is required on PATH for env-vars-file serialization. Stop."
}
& $PythonExe -c "import sys; raise SystemExit(0 if sys.version_info[0] == 3 else 1)"
if ($LASTEXITCODE -ne 0) {
  throw "Python 3 is required for env-vars-file serialization. Stop."
}
& $PythonExe -c "import yaml"
if ($LASTEXITCODE -ne 0) {
  throw "PyYAML is required (python -c ""import yaml""). Stop."
}
```

### Placeholder / variable safety (required before mutating commands)

Replace executable-looking placeholders with guarded PowerShell variables.
Before any mutating `gcloud` command in this procedure, validate that:

- no required variable is empty;
- no required variable contains `REPLACE_WITH_` anywhere in its value
  (including after prefixes such as `serviceAccount:` or `user:`);
- the selected delivery-board variable matches the dashboard discovery inside §9;
- optional values are omitted rather than submitted literally;
- caller identity has been explicitly approved (step 7).

Example stop condition:

```powershell
function Assert-DeployVar {
  param([string]$Name, [string]$Value, [switch]$Required)
  if ($Required -and [string]::IsNullOrWhiteSpace($Value)) {
    throw "Required variable $Name is empty. Stop."
  }
  if ($Value -and ($Value -like "*REPLACE_WITH_*")) {
    throw "Variable $Name still contains a REPLACE_WITH_ placeholder. Stop."
  }
}
```

---

## 5. Step 2 — Create the dedicated runtime service account

Create and use only:

```text
niva-mission-control-api-run@niva-hr-database.iam.gserviceaccount.com
```

Grant **only** (in step 4, after the application token secret exists):

- `roles/secretmanager.secretAccessor` on secret `trello-token`
- `roles/secretmanager.secretAccessor` on secret `mission-control-api-token`

Do **not** prescribe or grant:

- project-wide Secret Manager access
- `roles/datastore.user` (the delivery and weekly-report GETs do not read Firestore)
- Editor / Owner
- broad Cloud Run administrative roles on the runtime account
- Trello write permissions (the endpoint is read-only)

Example (PowerShell; do not run until authorized):

```powershell
$PROJECT_ID = "niva-hr-database"
$API_RUN_SA = "niva-mission-control-api-run@$PROJECT_ID.iam.gserviceaccount.com"

Assert-DeployVar -Name "PROJECT_ID" -Value $PROJECT_ID -Required
Assert-DeployVar -Name "API_RUN_SA" -Value $API_RUN_SA -Required

gcloud iam service-accounts create niva-mission-control-api-run `
  --project=$PROJECT_ID `
  --display-name="NIVA Mission Control API runtime"
```

Do **not** bind `mission-control-api-token` IAM yet — that secret does not exist
until step 3.

---

## 6. Step 3 — Generate and create `mission-control-api-token`

Create Secret Manager secret `mission-control-api-token` with at least **32
cryptographically random bytes**. Never commit, log, embed in source, print into
reports, or leave the value in reusable command history when avoidable.

**Stop** if `mission-control-api-token` already exists unless the operator is
explicitly performing an approved rotation (see §14). Do not use
`_verify-token.tmp`. Do not use a path inside the repository.

`Remove-Item` is **best-effort** temporary-file cleanup; it does not claim
perfect disk erasure.

Example (PowerShell; do not run until authorized):

```powershell
$PROJECT_ID = "niva-hr-database"
Assert-DeployVar -Name "PROJECT_ID" -Value $PROJECT_ID -Required

# Stop unless this is an approved rotation of an existing secret.
$existing = gcloud secrets describe mission-control-api-token --project=$PROJECT_ID 2>$null
if ($LASTEXITCODE -eq 0) {
  throw "Secret mission-control-api-token already exists. Stop unless performing an approved rotation."
}

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("mc-api-token-" + [guid]::NewGuid().ToString("N") + ".tmp")
$token = $null
$bytes = $null

try {
  $bytes = [byte[]]::new(32)
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  # Base64 of 32 random bytes → UTF-8-safe application token without printing the value.
  $token = [Convert]::ToBase64String($bytes)
  [System.IO.File]::WriteAllText($tmp, $token, [System.Text.UTF8Encoding]::new($false))

  gcloud secrets create mission-control-api-token `
    --project=$PROJECT_ID `
    --data-file=$tmp
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud secrets create failed."
  }
}
finally {
  if (Test-Path -LiteralPath $tmp) {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
  $token = $null
  $bytes = $null
}
```

Shorter, empty, or whitespace-only values are rejected at runtime (fail closed
with sanitized `500`). Map the secret into the service as
`MISSION_CONTROL_API_TOKEN` (see step 6 / §9).

---

## 7. Step 4 — Grant secretAccessor on both secrets

Only after `mission-control-api-token` exists:

```powershell
$PROJECT_ID = "niva-hr-database"
$API_RUN_SA = "niva-mission-control-api-run@$PROJECT_ID.iam.gserviceaccount.com"

Assert-DeployVar -Name "PROJECT_ID" -Value $PROJECT_ID -Required
Assert-DeployVar -Name "API_RUN_SA" -Value $API_RUN_SA -Required

gcloud secrets add-iam-policy-binding trello-token `
  --project=$PROJECT_ID `
  --member="serviceAccount:$API_RUN_SA" `
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding mission-control-api-token `
  --project=$PROJECT_ID `
  --member="serviceAccount:$API_RUN_SA" `
  --role="roles/secretmanager.secretAccessor"
```

---

## 8. Step 5 — Confirm required non-secret Trello configuration
**(explanatory / read-only — not an operator paste step)**

`GET /api/v1/delivery` and `GET /api/v1/weekly-report` both read normalized
delivery data from Trello (read-only). They need the same non-secret board
configuration already used by the dashboard.

This section lists **what** must be true. It does **not** instruct the operator
to paste `$Discovered*` variables or `TRELLO_API_KEY` into §9. The authoritative
§9 fresh-session procedure performs its own read-only dashboard discovery and
assigns those values in memory before any mutating command.

Do **not** print secret values (`TRELLO_TOKEN`, `MISSION_CONTROL_API_TOKEN`, or
any other secret payload). Do **not** extract or read secret payloads.

Required on the dashboard (and therefore on the API after §9 discovery):

- `DATA_SOURCE` exactly equal to lowercase `trello`
- `TRELLO_API_KEY` as a **literal** env value (not Secret Manager–backed)
- Delivery board configuration — **exactly one** of the forms already on the
  dashboard; do **not** silently convert between them:
  - `TRELLO_DELIVERY_BOARD_IDS` when that is what the dashboard uses; **or**
  - `TRELLO_BOARD_ID` when that is the existing source

Optional (omit from the deploy command if unused on the dashboard):

- `TRELLO_PROGRAM_BOARD_ID`
- `DATA_REVALIDATE_SECONDS` (when present, must be a positive integer)

Do not invent new board IDs for the initial deploy.

Not required for the delivery or weekly-report GETs:

- `ADMIN_EMAILS`
- authenticated dashboard / IAP user context
- Firestore / hidden-card state
- `roles/datastore.user`

HTTPS egress to `api.trello.com` is required. No VPC connector is currently
required.

---

## 9. Step 6 — Deploy `niva-mission-control-api` by digest

### Cloud Run configuration

| Setting | Value |
|---|---|
| Service | `niva-mission-control-api` |
| Project | `niva-hr-database` |
| Region | `us-central1` |
| Runtime service account | `niva-mission-control-api-run@niva-hr-database.iam.gserviceaccount.com` |
| Image | reviewed digest in §4 (authoritative); `:159cbbd` is provenance only |
| `MISSION_CONTROL_API_ONLY` | `true` |
| `MISSION_CONTROL_API_TOKEN` | secret `mission-control-api-token:latest` (see rotation notes) |
| `TRELLO_TOKEN` | secret `trello-token:latest` |
| Min instances | `0` (scale to zero) |
| Unauthenticated invocation | **denied** (`--no-allow-unauthenticated`) |
| IAP | **not** required on the API service |
| Public dashboard traffic | **none** |
| VPC connector | **none** unless later justified |

### Secret version mapping (`:latest`)

Initial deploy maps secrets with the `:latest` alias for environment-variable
injection. Cloud Run resolves the secret **when an instance starts**. After you
add a new Secret Manager version, a **new Cloud Run revision or configuration
update** is required before running instances resolve that newer version. See
§14 — do not assume `:latest` hot-reloads into already-running instances.

### Authoritative deploy (PowerShell; do not run until authorized)

Exactly **one** deploy procedure. Paste into a **fresh** Windows PowerShell
session. It redefines every variable and helper it uses — do not rely on state
from earlier steps. Do **not** paste `$Discovered*` or `TRELLO_API_KEY` values
from §5 or anywhere else; this block discovers them itself.

Before its first mutating command, the procedure runs one read-only
`gcloud run services describe` against project `niva-hr-database`, region
`us-central1`, service `niva-mission-control`, with structured JSON output.
It captures that JSON in memory (without printing it), validates exit code and
content, parses with `ConvertFrom-Json`, builds an in-memory name/value map of
dashboard container environment entries (literal values vs Secret Manager
references), and assigns deploy inputs programmatically. It does **not** print
the map, `TRELLO_API_KEY`, or secret references, and does **not** extract or
read secret payloads.

Non-secret env vars are written to a temporary YAML file and passed with
`--env-vars-file` (format confirmed by installed `gcloud run deploy --help`:
YAML or ENV; JSON is **not** listed). Secret values stay on `--set-secrets`
only. Serialization uses **PyYAML** (`yaml.safe_dump`) so commas, colons,
quotes, backslashes, and Unicode in board IDs / keys are preserved without a
hand-rolled YAML encoder. Requires Python **3** with PyYAML (resolved once via
`Get-Command python`, major version verified, same `$PythonExe` reused for
import check and serialization — verified in §4 and again in this fresh-session
block). **Do not** pipe JSON into Python via
the Windows PowerShell 5.1 native process pipeline — that path corrupts
non-ASCII (for example `café` becomes `caf?`). The documented serializer
writes UTF-8 JSON to a temp file, lets Python read that file and write the
YAML file directly, then removes the JSON temp file.

`--min-instances=0` permits idle scale-to-zero; it does **not** disable
request-triggered startup.

```powershell
# --- Fresh session: project / service / image ---
$PROJECT_ID  = "niva-hr-database"
$REGION      = "us-central1"
$API_SERVICE = "niva-mission-control-api"
$DASHBOARD_SERVICE = "niva-mission-control"
$API_RUN_SA  = "niva-mission-control-api-run@$PROJECT_ID.iam.gserviceaccount.com"
$IMAGE = "us-central1-docker.pkg.dev/niva-hr-database/niva/niva-mission-control@sha256:2a046c787d49e777113bb01531f777ee8ec6fb2f71a34fed782ca658c33e086e"

# Temp env-vars file path (outside the repository; unique per run).
$EnvVarsFile = Join-Path $env:TEMP ("niva-mc-api-env-" + [guid]::NewGuid().ToString("N") + ".yaml")

# Deploy inputs are assigned only by dashboard discovery below — not operator paste.
$DATA_SOURCE = $null
$DiscoveredDataSource = $null
$TRELLO_API_KEY = $null
$DiscoveredTrelloDeliveryBoardIds = $null
$DiscoveredTrelloBoardId = $null
$TRELLO_DELIVERY_BOARD_IDS = $null
$TRELLO_BOARD_ID = $null
$TRELLO_PROGRAM_BOARD_ID = $null
$DATA_REVALIDATE_SECONDS = $null

function Assert-DeployVar {
  param([string]$Name, [string]$Value, [switch]$Required)
  if ($Required -and [string]::IsNullOrWhiteSpace($Value)) {
    throw "Required variable $Name is empty. Stop."
  }
  if ($Value -and ($Value -like "*REPLACE_WITH_*")) {
    throw "Variable $Name still contains a REPLACE_WITH_ placeholder. Stop."
  }
}

function Assert-PathOutsideRepository {
  param([Parameter(Mandatory = $true)][string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path)) {
    throw "Temporary path is empty. Stop."
  }
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd([char]'\', [char]'/')
  $prefix = $tempRoot + [System.IO.Path]::DirectorySeparatorChar
  if (-not $fullPath.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Temporary path must be under the system temp directory (outside the repository). Stop."
  }
}

function Assert-PythonPyYaml {
  $PythonCommand = Get-Command python -ErrorAction Stop
  $exe = $PythonCommand.Source
  if ([string]::IsNullOrWhiteSpace($exe)) {
    throw "python is required on PATH for env-vars-file serialization. Stop."
  }
  & $exe -c "import sys; raise SystemExit(0 if sys.version_info[0] == 3 else 1)"
  if ($LASTEXITCODE -ne 0) {
    throw "Python 3 is required for env-vars-file serialization. Stop."
  }
  & $exe -c "import yaml"
  if ($LASTEXITCODE -ne 0) {
    throw "PyYAML is required (python -c ""import yaml""). Stop."
  }
  return $exe
}

function Assert-PositiveIntDeployVar {
  param([string]$Name, [string]$Value)
  Assert-DeployVar -Name $Name -Value $Value
  $parsed = 0
  # NumberStyles.None rejects leading/trailing whitespace, signs, decimals, and exponents.
  # Do not Trim or otherwise rewrite the discovered literal before this check.
  if (-not [int]::TryParse(
      $Value,
      [System.Globalization.NumberStyles]::None,
      [System.Globalization.CultureInfo]::InvariantCulture,
      [ref]$parsed
    )) {
    throw "Variable $Name must be a positive integer. Stop."
  }
  if ($parsed -le 0) {
    throw "Variable $Name must be a positive integer. Stop."
  }
}

function Get-DashboardLiteralEnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][hashtable]$LiteralEnv,
    [Parameter(Mandatory = $true)]$SecretEnvNames
  )
  if ($SecretEnvNames.Contains($Name)) {
    throw "Dashboard environment $Name is secret-backed; a literal value is required. Stop."
  }
  if (-not $LiteralEnv.ContainsKey($Name)) {
    throw "Dashboard environment $Name is missing. Stop."
  }
  $val = [string]$LiteralEnv[$Name]
  if ([string]::IsNullOrWhiteSpace($val)) {
    throw "Dashboard environment $Name is empty. Stop."
  }
  if ($val -like "*REPLACE_WITH_*") {
    throw "Dashboard environment $Name still contains a REPLACE_WITH_ placeholder. Stop."
  }
  return $val
}

function Write-CloudRunEnvVarsYamlFile {
  param(
    [System.Collections.IDictionary]$EnvMap,
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$PythonExe
  )
  # Flat string map -> UTF-8 JSON file -> PyYAML -> UTF-8 YAML file (no BOM).
  # Avoid PowerShell 5.1 native pipelines to/from python (they corrupt non-ASCII).
  Assert-PathOutsideRepository -Path $Path
  $jsonPath = Join-Path $env:TEMP ("niva-mc-api-env-json-" + [guid]::NewGuid().ToString("N") + ".json")
  Assert-PathOutsideRepository -Path $jsonPath
  try {
    $json = $EnvMap | ConvertTo-Json -Compress
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($jsonPath, $json, $utf8NoBom)
    & $PythonExe -c "import json,sys,yaml; from collections import OrderedDict; json_path,yaml_path=sys.argv[1],sys.argv[2]; data=json.load(open(json_path,encoding='utf-8'), object_pairs_hook=OrderedDict); yaml.safe_dump(dict(data), open(yaml_path,'w',encoding='utf-8',newline='\n'), default_flow_style=False, allow_unicode=True, sort_keys=False, default_style=chr(34))" $jsonPath $Path
    if ($LASTEXITCODE -ne 0) {
      throw "PyYAML serialization of env-vars file failed. Stop."
    }
    if (-not (Test-Path -LiteralPath $Path)) {
      throw "PyYAML produced an empty env-vars file. Stop."
    }
    $written = [System.IO.File]::ReadAllBytes($Path)
    if ($null -eq $written -or $written.Length -eq 0) {
      throw "PyYAML produced an empty env-vars file. Stop."
    }
  }
  finally {
    # Best-effort cleanup of the JSON staging file — not secure erasure.
    if ($jsonPath -and (Test-Path -LiteralPath $jsonPath)) {
      Remove-Item -LiteralPath $jsonPath -Force -ErrorAction SilentlyContinue
    }
  }
}

$PythonExe = Assert-PythonPyYaml
Assert-PathOutsideRepository -Path $EnvVarsFile
Assert-DeployVar -Name "PROJECT_ID" -Value $PROJECT_ID -Required
Assert-DeployVar -Name "REGION" -Value $REGION -Required
Assert-DeployVar -Name "API_SERVICE" -Value $API_SERVICE -Required
Assert-DeployVar -Name "DASHBOARD_SERVICE" -Value $DASHBOARD_SERVICE -Required
Assert-DeployVar -Name "API_RUN_SA" -Value $API_RUN_SA -Required
Assert-DeployVar -Name "IMAGE" -Value $IMAGE -Required

# --- Read-only dashboard discovery (before any mutating command) ---
# Capture JSON in memory; do not print it, the env map, TRELLO_API_KEY, or secret refs.
$DashboardDescribeJson = gcloud run services describe $DASHBOARD_SERVICE `
  --project=$PROJECT_ID `
  --region=$REGION `
  --format=json
if ($LASTEXITCODE -ne 0) {
  throw "gcloud run services describe (dashboard discovery) failed with exit code $LASTEXITCODE. Stop."
}
if ([string]::IsNullOrWhiteSpace($DashboardDescribeJson)) {
  throw "Dashboard describe returned null, empty, or whitespace. Stop."
}

$DashboardService = $null
try {
  $DashboardService = $DashboardDescribeJson | ConvertFrom-Json
} catch {
  throw "Dashboard describe JSON is malformed. Stop."
}
$DashboardDescribeJson = $null

if (
  $null -eq $DashboardService -or
  $null -eq $DashboardService.spec -or
  $null -eq $DashboardService.spec.template -or
  $null -eq $DashboardService.spec.template.spec -or
  $null -eq $DashboardService.spec.template.spec.containers
) {
  throw "Dashboard describe JSON has unexpected structure (missing containers). Stop."
}

$containers = @($DashboardService.spec.template.spec.containers)
if ($containers.Count -ne 1) {
  throw "Dashboard describe JSON has unexpected structure (expected exactly one container). Stop."
}
if ($null -eq $containers[0]) {
  throw "Dashboard describe JSON has unexpected structure (null container). Stop."
}

if ($null -eq $containers[0].env) {
  throw "Dashboard container environment array is missing. Stop."
}
$envEntries = @($containers[0].env)

# In-memory name/value map: literals only. Secret-backed names tracked separately.
# Do not print this map. Do not extract or read secret payloads.
$LiteralEnv = @{}
$SecretEnvNames = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)

foreach ($entry in $envEntries) {
  if ($null -eq $entry -or [string]::IsNullOrWhiteSpace([string]$entry.name)) {
    throw "Dashboard environment entry is malformed (missing name). Stop."
  }
  $envName = [string]$entry.name
  if ($LiteralEnv.ContainsKey($envName) -or $SecretEnvNames.Contains($envName)) {
    throw "Duplicate dashboard environment name detected. Stop."
  }
  $hasSecretRef = $false
  if ($null -ne $entry.valueFrom -and $null -ne $entry.valueFrom.secretKeyRef) {
    $hasSecretRef = $true
  }
  $hasLiteral = $false
  if ($null -ne ($entry.PSObject.Properties['value'])) {
    # Present as a literal slot (including empty string).
    $hasLiteral = $true
  }
  if ($hasSecretRef -and $hasLiteral -and -not [string]::IsNullOrEmpty([string]$entry.value)) {
    throw "Dashboard environment entry is malformed (both literal value and secret reference). Stop."
  }
  if ($hasSecretRef) {
    [void]$SecretEnvNames.Add($envName)
  } elseif ($hasLiteral) {
    $LiteralEnv[$envName] = [string]$entry.value
  } else {
    throw "Dashboard environment entry is malformed (neither literal value nor secret reference). Stop."
  }
}

# Required: DATA_SOURCE must be discovered and equal exact lowercase trello.
$DiscoveredDataSource = Get-DashboardLiteralEnvValue -Name "DATA_SOURCE" -LiteralEnv $LiteralEnv -SecretEnvNames $SecretEnvNames
if ($DiscoveredDataSource -cne "trello") {
  throw "Discovered DATA_SOURCE must be exactly trello. Stop."
}
$DATA_SOURCE = "trello"
if ($DATA_SOURCE -cne $DiscoveredDataSource) {
  throw "Proposed DATA_SOURCE does not exactly match discovered DATA_SOURCE. Stop."
}
Assert-DeployVar -Name "DATA_SOURCE" -Value $DATA_SOURCE -Required
Assert-DeployVar -Name "DiscoveredDataSource" -Value $DiscoveredDataSource -Required

# Required: TRELLO_API_KEY must be a non-empty literal (not secret-backed / not placeholder).
$TRELLO_API_KEY = Get-DashboardLiteralEnvValue -Name "TRELLO_API_KEY" -LiteralEnv $LiteralEnv -SecretEnvNames $SecretEnvNames
Assert-DeployVar -Name "TRELLO_API_KEY" -Value $TRELLO_API_KEY -Required

# Exactly one delivery-board variable on the dashboard; use the same name and exact value.
$deliveryBoardNames = @("TRELLO_DELIVERY_BOARD_IDS", "TRELLO_BOARD_ID")
$presentDeliveryBoardNames = @()
foreach ($boardName in $deliveryBoardNames) {
  if ($LiteralEnv.ContainsKey($boardName) -or $SecretEnvNames.Contains($boardName)) {
    $presentDeliveryBoardNames += $boardName
  }
}
if ($presentDeliveryBoardNames.Count -ne 1) {
  throw "Dashboard discovery must show exactly one of TRELLO_DELIVERY_BOARD_IDS or TRELLO_BOARD_ID. Stop."
}
$selectedDeliveryBoardName = $presentDeliveryBoardNames[0]
$selectedDeliveryBoardValue = Get-DashboardLiteralEnvValue -Name $selectedDeliveryBoardName -LiteralEnv $LiteralEnv -SecretEnvNames $SecretEnvNames

$DiscoveredTrelloDeliveryBoardIds = $null
$DiscoveredTrelloBoardId = $null
$TRELLO_DELIVERY_BOARD_IDS = $null
$TRELLO_BOARD_ID = $null
if ($selectedDeliveryBoardName -eq "TRELLO_DELIVERY_BOARD_IDS") {
  $DiscoveredTrelloDeliveryBoardIds = $selectedDeliveryBoardValue
  $TRELLO_DELIVERY_BOARD_IDS = $DiscoveredTrelloDeliveryBoardIds
} else {
  $DiscoveredTrelloBoardId = $selectedDeliveryBoardValue
  $TRELLO_BOARD_ID = $DiscoveredTrelloBoardId
}

$hasDeliveryIds = -not [string]::IsNullOrWhiteSpace($TRELLO_DELIVERY_BOARD_IDS)
$hasBoardId = -not [string]::IsNullOrWhiteSpace($TRELLO_BOARD_ID)
if ($hasDeliveryIds -eq $hasBoardId) {
  throw "Exactly one of TRELLO_DELIVERY_BOARD_IDS or TRELLO_BOARD_ID must be set. Stop."
}
$discoveredHasDeliveryIds = -not [string]::IsNullOrWhiteSpace($DiscoveredTrelloDeliveryBoardIds)
$discoveredHasBoardId = -not [string]::IsNullOrWhiteSpace($DiscoveredTrelloBoardId)
if ($discoveredHasDeliveryIds -eq $discoveredHasBoardId) {
  throw "Dashboard discovery must show exactly one of TRELLO_DELIVERY_BOARD_IDS or TRELLO_BOARD_ID. Stop."
}
if ($hasDeliveryIds -ne $discoveredHasDeliveryIds) {
  throw "Selected delivery-board form does not match the dashboard-discovered form. Stop."
}
if ($hasDeliveryIds) {
  Assert-DeployVar -Name "TRELLO_DELIVERY_BOARD_IDS" -Value $TRELLO_DELIVERY_BOARD_IDS -Required
  Assert-DeployVar -Name "DiscoveredTrelloDeliveryBoardIds" -Value $DiscoveredTrelloDeliveryBoardIds -Required
  if ($TRELLO_DELIVERY_BOARD_IDS -cne $DiscoveredTrelloDeliveryBoardIds) {
    throw "TRELLO_DELIVERY_BOARD_IDS does not exactly match the dashboard-discovered value. Stop."
  }
} else {
  Assert-DeployVar -Name "TRELLO_BOARD_ID" -Value $TRELLO_BOARD_ID -Required
  Assert-DeployVar -Name "DiscoveredTrelloBoardId" -Value $DiscoveredTrelloBoardId -Required
  if ($TRELLO_BOARD_ID -cne $DiscoveredTrelloBoardId) {
    throw "TRELLO_BOARD_ID does not exactly match the dashboard-discovered value. Stop."
  }
}

# Optional: copy when present on the dashboard; omit when absent.
$TRELLO_PROGRAM_BOARD_ID = $null
if ($LiteralEnv.ContainsKey("TRELLO_PROGRAM_BOARD_ID") -or $SecretEnvNames.Contains("TRELLO_PROGRAM_BOARD_ID")) {
  $TRELLO_PROGRAM_BOARD_ID = Get-DashboardLiteralEnvValue -Name "TRELLO_PROGRAM_BOARD_ID" -LiteralEnv $LiteralEnv -SecretEnvNames $SecretEnvNames
  Assert-DeployVar -Name "TRELLO_PROGRAM_BOARD_ID" -Value $TRELLO_PROGRAM_BOARD_ID
}

$DATA_REVALIDATE_SECONDS = $null
if ($LiteralEnv.ContainsKey("DATA_REVALIDATE_SECONDS") -or $SecretEnvNames.Contains("DATA_REVALIDATE_SECONDS")) {
  $DATA_REVALIDATE_SECONDS = Get-DashboardLiteralEnvValue -Name "DATA_REVALIDATE_SECONDS" -LiteralEnv $LiteralEnv -SecretEnvNames $SecretEnvNames
  Assert-PositiveIntDeployVar -Name "DATA_REVALIDATE_SECONDS" -Value $DATA_REVALIDATE_SECONDS
}

# Drop discovery intermediates before mutation (do not print).
$LiteralEnv = $null
$SecretEnvNames = $null
$DashboardService = $null
$envEntries = $null
$containers = $null

# Ordered non-secret environment map (secrets are NOT included).
$EnvMap = [ordered]@{
  DATA_SOURCE = $DATA_SOURCE
  TRELLO_API_KEY = $TRELLO_API_KEY
}
if ($hasDeliveryIds) {
  $EnvMap["TRELLO_DELIVERY_BOARD_IDS"] = $TRELLO_DELIVERY_BOARD_IDS
} else {
  $EnvMap["TRELLO_BOARD_ID"] = $TRELLO_BOARD_ID
}
if ($TRELLO_PROGRAM_BOARD_ID) {
  $EnvMap["TRELLO_PROGRAM_BOARD_ID"] = $TRELLO_PROGRAM_BOARD_ID
}
if ($DATA_REVALIDATE_SECONDS) {
  $EnvMap["DATA_REVALIDATE_SECONDS"] = $DATA_REVALIDATE_SECONDS
}
$EnvMap["MISSION_CONTROL_API_ONLY"] = "true"

try {
  Write-CloudRunEnvVarsYamlFile -EnvMap $EnvMap -Path $EnvVarsFile -PythonExe $PythonExe
  # Do not print the complete environment file in normal operation.

  gcloud run deploy $API_SERVICE `
    --project=$PROJECT_ID `
    --region=$REGION `
    --image=$IMAGE `
    --service-account=$API_RUN_SA `
    --no-allow-unauthenticated `
    --min-instances=0 `
    --memory=512Mi `
    --env-vars-file=$EnvVarsFile `
    --set-secrets="MISSION_CONTROL_API_TOKEN=mission-control-api-token:latest,TRELLO_TOKEN=trello-token:latest"
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud run deploy failed with exit code $LASTEXITCODE. Stop."
  }
}
finally {
  # Best-effort cleanup — not secure erasure.
  if ($EnvVarsFile -and (Test-Path -LiteralPath $EnvVarsFile)) {
    Remove-Item -LiteralPath $EnvVarsFile -Force -ErrorAction SilentlyContinue
  }
  $EnvMap = $null
  $json = $null
  $TRELLO_API_KEY = $null
}

```

Do not copy secret payloads into documentation, command history reports, or
source control. Do not use `_verify-token.tmp` or any repository path for the
env-vars file.

---

## 10. Step 7 — Caller authorization

Grant `roles/run.invoker` on **`niva-mission-control-api` only** to:

- the future MCP service account
- specifically approved operator identities when needed

Do **not** use `allUsers` or `allAuthenticatedUsers`.

Supported IAM member types for this runbook are **only**:

- `serviceAccount:`
- `user:`

Do **not** grant `group:`, `domain:`, `principal:`, `principalSet:`,
`deleted:` principals, or other member types unless a later architecture
decision explicitly requires them.

Caller identities have **not** yet been selected. Placeholders below are
deliberately invalid and are rejected by the validator until replaced with
approved members **and** `$ApproveInvokerIamMutation` is set to `$true`.
Do **not** silently authorize the current gcloud identity.

Immediate containment later requires iterating the **recorded** approved
caller set and removing each `roles/run.invoker` binding, then performing
read-only IAM verification (see §14).

```powershell
$PROJECT_ID  = "niva-hr-database"
$REGION      = "us-central1"
$API_SERVICE = "niva-mission-control-api"
$InvokerRole = "roles/run.invoker"

# Explicit approved-caller collection (replace placeholders with real approved
# members before mutation). Ordinal, case-insensitive exact match is required.
$ApprovedCallerMembers = @(
  "serviceAccount:REPLACE_WITH_MCP_CALLER_SA@REPLACE_WITH_PROJECT.iam.gserviceaccount.com"
  # Optional second approved caller example (still invalid until replaced):
  # "user:REPLACE_WITH_APPROVED_OPERATOR@REPLACE_WITH_DOMAIN"
)

# Selected caller for this mutation — must match an allowlist entry exactly.
$SelectedCallerMember = "serviceAccount:REPLACE_WITH_MCP_CALLER_SA@REPLACE_WITH_PROJECT.iam.gserviceaccount.com"

# Defaults to false. Set to $true only after deliberate operator approval.
$ApproveInvokerIamMutation = $false

function Assert-IamCallerMemberForm {
  param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Member, [string]$Label = "caller")
  if ([string]::IsNullOrWhiteSpace($Member)) {
    throw "$Label is null, empty, or whitespace. Stop."
  }
  if ($Member.Contains("REPLACE_WITH_")) {
    throw "$Label still contains REPLACE_WITH_. Stop."
  }
  if ($Member.Contains("<") -or $Member.Contains(">")) {
    throw "$Label contains angle brackets. Stop."
  }
  if ($Member -match "\s") {
    throw "$Label contains whitespace. Stop."
  }
  if ($Member -match "[,;|/]") {
    throw "$Label contains unexpected delimiters. Stop."
  }
  # Exactly one supported prefix; reject stacked/multiple prefixes.
  if ($Member -notmatch '^(serviceAccount|user):([^:]+)$') {
    throw "$Label must be exactly 'serviceAccount:<email>' or 'user:<email>'. Stop."
  }
  $email = $Matches[2]
  if ($email -notmatch '^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$') {
    throw "$Label lacks a syntactically plausible email-style identifier after the prefix. Stop."
  }
}

function Assert-ApprovedCallerAllowlist {
  param([string[]]$ApprovedCallerMembers)
  if ($null -eq $ApprovedCallerMembers -or $ApprovedCallerMembers.Count -lt 1) {
    throw "ApprovedCallerMembers is empty. Stop."
  }
  foreach ($entry in $ApprovedCallerMembers) {
    Assert-IamCallerMemberForm -Member $entry -Label "Allowlist entry"
  }
}

function Assert-SelectedCallerApproved {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$SelectedCallerMember,
    [Parameter(Mandatory = $true)][string[]]$ApprovedCallerMembers
  )
  Assert-IamCallerMemberForm -Member $SelectedCallerMember -Label "SelectedCallerMember"
  $matched = $false
  foreach ($entry in $ApprovedCallerMembers) {
    if ([string]::Equals($SelectedCallerMember, $entry, [System.StringComparison]::OrdinalIgnoreCase)) {
      $matched = $true
      break
    }
  }
  if (-not $matched) {
    throw "SelectedCallerMember is not exactly present in ApprovedCallerMembers. Stop."
  }
}

function Assert-InvokerIamMutationApproved {
  param([bool]$ApproveInvokerIamMutation)
  if (-not $ApproveInvokerIamMutation) {
    throw "Invoker IAM mutation not approved. Set ApproveInvokerIamMutation to `$true deliberately after review. Stop."
  }
}

# Validate allowlist entries themselves before any mutation.
Assert-ApprovedCallerAllowlist -ApprovedCallerMembers $ApprovedCallerMembers
Assert-SelectedCallerApproved -SelectedCallerMember $SelectedCallerMember -ApprovedCallerMembers $ApprovedCallerMembers
Assert-InvokerIamMutationApproved -ApproveInvokerIamMutation $ApproveInvokerIamMutation

gcloud run services add-iam-policy-binding $API_SERVICE `
  --project=$PROJECT_ID `
  --region=$REGION `
  --member=$SelectedCallerMember `
  --role=$InvokerRole
if ($LASTEXITCODE -ne 0) {
  throw "add-iam-policy-binding failed with exit code $LASTEXITCODE. Stop."
}

# Removal uses the same validators (example — set SelectedCallerMember to the
# member being revoked; keep ApproveInvokerIamMutation deliberate):
# Assert-ApprovedCallerAllowlist -ApprovedCallerMembers $ApprovedCallerMembers
# Assert-SelectedCallerApproved -SelectedCallerMember $SelectedCallerMember -ApprovedCallerMembers $ApprovedCallerMembers
# Assert-InvokerIamMutationApproved -ApproveInvokerIamMutation $ApproveInvokerIamMutation
# gcloud run services remove-iam-policy-binding $API_SERVICE `
#   --project=$PROJECT_ID `
#   --region=$REGION `
#   --member=$SelectedCallerMember `
#   --role=$InvokerRole
# if ($LASTEXITCODE -ne 0) {
#   throw "remove-iam-policy-binding failed with exit code $LASTEXITCODE. Stop."
# }
```

Every IAM mutation above is scoped to project `niva-hr-database`, region
`us-central1`, service `niva-mission-control-api`, and role `roles/run.invoker`.

The MCP caller must also supply the application bearer token (Layer 2). Granting
`roles/run.invoker` on the API does **not** grant access to
`niva-mission-control` or its IAP principals. The MCP runtime identity requires
`roles/run.invoker` on `niva-mission-control-api`.

---

## 11. Step 8 — Acquire a correctly targeted identity token

After deployment, read the API service URL and use that **exact HTTPS URL** as
the identity-token audience unless a custom audience was explicitly configured.

```powershell
$PROJECT_ID = "niva-hr-database"
$REGION = "us-central1"
$API_SERVICE = "niva-mission-control-api"

$ApiUrl = gcloud run services describe $API_SERVICE `
  --project=$PROJECT_ID `
  --region=$REGION `
  --format="value(status.url)"

Assert-DeployVar -Name "ApiUrl" -Value $ApiUrl -Required
if ($ApiUrl -notlike "https://*") {
  throw "ApiUrl must be the HTTPS Cloud Run service URL. Stop."
}

# OpenID Connect identity token for the API service URL audience.
# Not an OAuth access token. Do not print the token into logs or chat.
$GOOGLE_IDENTITY_TOKEN = gcloud auth print-identity-token --audiences="$ApiUrl"
Assert-DeployVar -Name "GOOGLE_IDENTITY_TOKEN" -Value $GOOGLE_IDENTITY_TOKEN -Required
```

Place credentials only as:

- `X-Serverless-Authorization: Bearer <GOOGLE_IDENTITY_TOKEN>`
- `Authorization: Bearer <MISSION_CONTROL_API_TOKEN>`

A wrong-audience identity token should fail at the Cloud Run IAM boundary.
Future MCP callers must mint an identity token for this same receiving API
service URL (or an explicitly configured custom audience).

Do not invoke the service during documentation-only phases.

---

## 12. Step 9 — Validation matrix

Do **not** invoke these endpoints during documentation-only phases. When a
deployment phase is authorized, expect:

| Case | Expected behavior |
|---|---|
| No Google identity and no application token | Cloud Run IAM rejects before the app (typically `403`) |
| Google identity only (valid invoker, no / wrong `Authorization`) | Request may reach the app; application returns sanitized `401` |
| Application token only (no Google identity / no invoker) | Cloud Run IAM rejects before the app (typically `403`); bearer token alone is insufficient |
| Valid Google identity + invalid application token | Application returns sanitized `401` |
| Valid Google identity + valid application token on `/api/v1/delivery` | `200` JSON delivery portfolio (`schemaVersion` `1.0`), `Cache-Control: no-store` |
| Valid Google identity + valid application token on `/api/v1/weekly-report` | `200` Markdown weekly status (`text/markdown; charset=utf-8`), `Cache-Control: no-store`, `Content-Disposition: attachment` |
| Valid credentials + invalid `asOf` on `/api/v1/weekly-report` | Application returns sanitized `400` (`{ "error": "Invalid asOf" }`); repository is not called |
| Wrong-audience Google identity token (valid invoker identity; audience ≠ API service URL) | Cloud Run IAM rejects before the app (typically `403`) |
| OAuth access token substituted for the identity token in `X-Serverless-Authorization` | Cloud Run IAM rejects before the app (typically `403`); access token ≠ identity token |
| Non-API route (e.g. `/api/projects`) with both valid credentials | Middleware returns `404` (`MISSION_CONTROL_API_ONLY=true`) |
| Dashboard route (e.g. `/`) against the API-only service | Middleware returns `404` |
| Unsupported method on `/api/v1/delivery` or `/api/v1/weekly-report` (e.g. `POST`) | Application/framework rejects; no write-capable handlers are implemented |
| Existing dashboard `niva-mission-control` | Still IAP-protected and unaffected; traffic / revision / IAP unchanged |

Upstream Trello failure on an otherwise authorized delivery or weekly-report
request returns sanitized `502`.

### Route behavior (accurate)

- API-only middleware permits **`/api/v1/delivery`** and **`/api/v1/weekly-report`**
  by exact pathname. It does **not** itself filter by HTTP method.
- Each committed route implements **`GET` only**.
- Unsupported methods are rejected by the application/framework.
- No write-capable delivery or weekly-report handler is implemented.

Example authorized delivery probe shape (placeholders only; do not run until
authorized). Assumes `$ApiUrl` and `$GOOGLE_IDENTITY_TOKEN` from step 8. Load
the application token into `$APP_BEARER_TOKEN` without printing it
(operator-controlled secret access — not documented as echoing secret payloads).

```powershell
$DeliveryUrl = "$ApiUrl/api/v1/delivery"
Assert-DeployVar -Name "DeliveryUrl" -Value $DeliveryUrl -Required
Assert-DeployVar -Name "GOOGLE_IDENTITY_TOKEN" -Value $GOOGLE_IDENTITY_TOKEN -Required
Assert-DeployVar -Name "APP_BEARER_TOKEN" -Value $APP_BEARER_TOKEN -Required

# Layer 1 in X-Serverless-Authorization; Layer 2 in Authorization — never swap/overwrite.
Invoke-WebRequest -Uri $DeliveryUrl -Headers @{
  "X-Serverless-Authorization" = "Bearer $GOOGLE_IDENTITY_TOKEN"
  "Authorization" = "Bearer $APP_BEARER_TOKEN"
}
```

Example authorized weekly-report probe shape (placeholders only; do not run
until authorized). Optional `asOf` shown for deterministic verification:

```powershell
$WeeklyReportUrl = "$ApiUrl/api/v1/weekly-report?asOf=2026-07-19T22:00:00-04:00"
Assert-DeployVar -Name "WeeklyReportUrl" -Value $WeeklyReportUrl -Required
Assert-DeployVar -Name "GOOGLE_IDENTITY_TOKEN" -Value $GOOGLE_IDENTITY_TOKEN -Required
Assert-DeployVar -Name "APP_BEARER_TOKEN" -Value $APP_BEARER_TOKEN -Required

Invoke-WebRequest -Uri $WeeklyReportUrl -Headers @{
  "X-Serverless-Authorization" = "Bearer $GOOGLE_IDENTITY_TOKEN"
  "Authorization" = "Bearer $APP_BEARER_TOKEN"
} -OutFile "niva-weekly-status.md"
```

---

## 13. Step 10 — Record the resulting API revision and configuration

After a successful authorized deploy and validation, record (for operations
handoff — not for this documentation-only phase):

- API service URL (`status.url`)
- Serving revision name
- Image digest actually deployed
- Non-secret env var names/values used (delivery-board form chosen)
- Secret names mapped (not secret payloads)
- Invoker principals granted

Do not record application bearer tokens or identity tokens.

---

## 14. Rotation, rollback, and immediate containment

All procedures below are limited to **`niva-mission-control-api`**. Do **not**
alter `niva-mission-control`, its IAP configuration, revision, traffic, or
build trigger.

### How `MISSION_CONTROL_API_TOKEN` is loaded

`MISSION_CONTROL_API_TOKEN` is injected as an **environment variable** and
resolved from Secret Manager **when a Cloud Run instance starts**.

Therefore:

- Disabling a Secret Manager version blocks **future** resolution of that
  version.
- Disabling a version does **not** erase a token already loaded into a
  **running** instance.
- Adding or selecting a new secret version requires a **new Cloud Run revision
  or configuration update** so new instances resolve the new value.
- Full application-token revocation requires **recycling all instances** that
  may still hold the prior value.
- Scale-to-zero alone must **not** be assumed immediate unless verified
  (cold instances may still exist until recycled, or warm instances may retain
  the old env until replaced).

### Separate operations (do not conflate)

1. **Immediate caller containment (primary)** — scoped only to
   `niva-mission-control-api`. Use unambiguous controls only:

   - Remove `roles/run.invoker` from **every** explicitly authorized caller
     recorded in the approved-caller set (iterate `$ApprovedCallerMembers`
     from §10; validate each member with the same allowlist helpers before
     `gcloud run services remove-iam-policy-binding`, and check
     `$LASTEXITCODE` after each removal).
   - Verify with a **read-only** `gcloud run services get-iam-policy` that no
     unintended invoker bindings remain on the API service.
   - Confirm unauthenticated invocation remains disabled on the API service
     (no `allUsers` / `allAuthenticatedUsers` invoker; deploy used
     `--no-allow-unauthenticated`).
   - When authorized, rotate the application bearer token and deploy a
     replacement API revision so instances resolve the new secret version.

   Prefer invoker revocation over relying only on secret disablement. Do
   **not** attempt to “disable” the service by assigning `0%` traffic to every
   revision (`--to-revisions=…=0`); Cloud Run traffic splits allocate serving
   percentages and cannot stop the service that way.

   Example full containment on the API service only (do not run until
   authorized). Define the §10 `Assert-ApprovedCallerAllowlist`,
   `Assert-SelectedCallerApproved`, and `Assert-InvokerIamMutationApproved`
   functions in the same session before this block:

   ```powershell
   $PROJECT_ID  = "niva-hr-database"
   $REGION      = "us-central1"
   $API_SERVICE = "niva-mission-control-api"
   $InvokerRole = "roles/run.invoker"

   # Must be the recorded approved-caller set actually granted earlier.
   $ApprovedCallerMembers = @(
     "serviceAccount:REPLACE_WITH_MCP_CALLER_SA@REPLACE_WITH_PROJECT.iam.gserviceaccount.com"
   )
   $ApproveInvokerIamMutation = $false  # set $true only after deliberate approval

   Assert-ApprovedCallerAllowlist -ApprovedCallerMembers $ApprovedCallerMembers
   Assert-InvokerIamMutationApproved -ApproveInvokerIamMutation $ApproveInvokerIamMutation

   foreach ($member in $ApprovedCallerMembers) {
     Assert-SelectedCallerApproved -SelectedCallerMember $member -ApprovedCallerMembers $ApprovedCallerMembers
     gcloud run services remove-iam-policy-binding $API_SERVICE `
       --project=$PROJECT_ID `
       --region=$REGION `
       --member=$member `
       --role=$InvokerRole
     if ($LASTEXITCODE -ne 0) {
       throw "remove-iam-policy-binding failed for $member with exit code $LASTEXITCODE. Stop."
     }
   }

   # Read-only verification — confirm no unintended invokers remain.
   gcloud run services get-iam-policy $API_SERVICE `
     --project=$PROJECT_ID `
     --region=$REGION
   if ($LASTEXITCODE -ne 0) {
     throw "get-iam-policy failed with exit code $LASTEXITCODE. Stop."
   }
   ```

   Accurate distinctions (do **not** treat these as emergency disablement):

   - `--min-instances=0` permits idle scale-to-zero; it does **not** disable
     request-triggered startup.
   - Traffic percentages cannot all be assigned zero as a disable mechanism.
   - Disabling a Secret Manager version does **not** clear a token already
     loaded into running instances.

   Do **not** prescribe `--scaling=0`, `--scaling=auto`, or manual scaling as
   an emergency-disable mechanism (installed `gcloud` help accepts `auto` or a
   **positive** integer for `--scaling` and does not unambiguously accept `0`).

2. **Application-token rotation** — add a new `mission-control-api-token`
   version; update callers to the new token; deploy a new API revision (or
   configuration update) so instances resolve the new version; then disable the
   previous secret version; recycle any instances that may still hold the prior
   value.
3. **API revision replacement** — route `niva-mission-control-api` traffic to a
   previous known-good **API** revision
   (`gcloud run services update-traffic` on the API service only), or deploy a
   replacement API revision by digest. Use this for rollback to a known-good
   serving revision — not as a zero-traffic disable.
4. **Fail-closed revision (separately authorized only)** — deploy a separately
   reviewed fail-closed API revision only when explicitly authorized. No
   command is provided here because no such reviewed artifact exists yet.
5. **Explicitly authorized service deletion** — delete
   `niva-mission-control-api` only if explicitly authorized. This is
   **destructive** and outside routine rollback; never touch
   `niva-mission-control`.

### Application-token rotation (ordered)

1. Immediate containment if a caller is compromised: revoke that caller’s
   `roles/run.invoker` on `niva-mission-control-api` (or, for full containment,
   remove invoker from every recorded approved caller and verify IAM as in
   item 1 above).
2. Add a new secret version on `mission-control-api-token`.
3. Deploy or update `niva-mission-control-api` so new instances resolve the new
   version (`:latest` mapping still requires a revision/config update; if you
   pin a numeric version, advance the pin to the new version in the same update).
4. Update callers (MCP / connector / operators) to the new application token.
5. Disable the previous secret version (blocks future resolution only).
6. Recycle remaining API instances that may still hold the prior env value;
   verify instance replacement rather than assuming idle scale-to-zero clears
   loaded env values.

The IAP-protected dashboard remains independent throughout.

---

## 15. Build and automation boundary

- Trigger **`niva-mission-control-main`** (ID `9d485749-f306-4299-ba95-b61d2ebdc16c`)
  deploys the existing **`niva-mission-control`** dashboard from `cloudbuild.yaml`.
- Do **not** repurpose that trigger for the API service.
- Initial API deployment reuses the reviewed image **digest** (see §4); `:159cbbd`
  is provenance for commit `159cbbd` only.
- A separate API build/deployment configuration may be designed later.
- **No new Cloud Build trigger** is part of the initial private API deployment.

---

## 16. Behavioral limitation — hidden cards

The delivery API and weekly-report API do **not** currently apply Firestore
hidden-card filtering.

- Cards hidden in the dashboard UI may still appear in `GET /api/v1/delivery`
  JSON and in `GET /api/v1/weekly-report` Markdown.
- This difference is **accepted** for the initial private deployment.
- Adding hidden-card parity is a separate product decision and code change.
- Do **not** grant Firestore / `roles/datastore.user` to the API runtime
  account merely to eliminate this documented difference.

---

## Endpoint summary

### Delivery portfolio (JSON)

```http
GET /api/v1/delivery
X-Serverless-Authorization: Bearer <GOOGLE_IDENTITY_TOKEN>
Authorization: Bearer <MISSION_CONTROL_API_TOKEN>
```

- Success: JSON delivery portfolio (`schemaVersion` `1.0`)
- Missing / malformed / wrong application credentials: sanitized `401` + `WWW-Authenticate: Bearer`
- Missing server token: fail closed with sanitized `500`
- Upstream data failure: sanitized `502`
- All application responses: `Cache-Control: no-store`
- Middleware (API-only): permits `/api/v1/delivery` by path; method filtering is
  not performed by middleware
- Route: `GET` only; no write-capable delivery handler
- Credentials are accepted only via the `Authorization` header — never query
  parameters or cookies. Cloud Run IAM still requires a valid invoker identity
  token in `X-Serverless-Authorization`.

### Weekly report (Markdown)

```http
GET /api/v1/weekly-report
X-Serverless-Authorization: Bearer <GOOGLE_IDENTITY_TOKEN>
Authorization: Bearer <MISSION_CONTROL_API_TOKEN>
```

Optional deterministic timestamp (testing / operator verification):

```http
GET /api/v1/weekly-report?asOf=2026-07-19T22:00:00-04:00
X-Serverless-Authorization: Bearer <GOOGLE_IDENTITY_TOKEN>
Authorization: Bearer <MISSION_CONTROL_API_TOKEN>
```

| Aspect | Behavior |
|---|---|
| Route | `GET /api/v1/weekly-report` only |
| Auth | Same dual layers as delivery: Cloud Run IAM invoker + application bearer (`MISSION_CONTROL_API_TOKEN`, min 32 UTF-8 bytes) |
| Middleware | API-only allowlist includes `/api/v1/weekly-report` (exact pathname) |
| Query params | Optional `asOf` only |
| Default time | When `asOf` is omitted, the route uses the server clock (“now”) |
| Week window | Monday 12:00:00 AM America/New_York through `asOf` (or now) |
| `asOf` | Optional calendar-valid ISO-8601 datetime with explicit `Z` or numeric UTC offset (e.g. `2026-07-19T22:00:00Z`). Date-only, timezone-naive, and impossible calendar dates (e.g. `2026-02-30T12:00:00Z`) are rejected with `400`. Invalid values are not replaced with “now”. |
| Success | `200` with `Content-Type: text/markdown; charset=utf-8` |
| Caching | `Cache-Control: no-store` |
| Filename | `Content-Disposition: attachment; filename="niva-weekly-status-YYYY-MM-DD.md"` using the America/New_York calendar date of `asOf` (or now) |
| Body | Same Markdown generator as the dashboard **Weekly report** button (`buildWeeklyReportMarkdown`) |
| Errors | `401` unauthorized · `400` invalid `asOf` · `500` misconfigured token · `502` upstream failure (sanitized bodies) |
| Upstream | Read-only repository `getProjects()` (Trello-backed when `DATA_SOURCE=trello`); no Trello writes |
| Relationship to delivery | Sibling read-only v1 route; same auth, same API-only middleware gate, different response format |

API-only mode (`MISSION_CONTROL_API_ONLY=true`) allows **only**:

- `/api/v1/delivery`
- `/api/v1/weekly-report`

All other paths return plain `404`.

This source phase does **not** itself:

- create Google Docs;
- write files to Google Drive;
- create Cloud Scheduler jobs;
- mutate Trello;
- expose write APIs;
- deploy production automation;
- create or configure a ChatGPT connector.

#### Example (PowerShell; placeholders only — do not run until authorized)

```powershell
# Dual auth: Layer 1 identity token + Layer 2 application bearer.
Invoke-WebRequest `
  -Uri "$ApiUrl/api/v1/weekly-report" `
  -Headers @{
    "X-Serverless-Authorization" = "Bearer $GOOGLE_IDENTITY_TOKEN"
    "Authorization" = "Bearer $APP_BEARER_TOKEN"
  } `
  -OutFile "niva-weekly-status.md"
```

With a fixed `asOf`:

```powershell
Invoke-WebRequest `
  -Uri "$ApiUrl/api/v1/weekly-report?asOf=2026-07-19T22:00:00-04:00" `
  -Headers @{
    "X-Serverless-Authorization" = "Bearer $GOOGLE_IDENTITY_TOKEN"
    "Authorization" = "Bearer $APP_BEARER_TOKEN"
  } `
  -OutFile "niva-weekly-status.md"
```

#### Example (curl; placeholders only — do not run until authorized)

```bash
curl -fsS \
  -H "X-Serverless-Authorization: Bearer ${GOOGLE_IDENTITY_TOKEN}" \
  -H "Authorization: Bearer ${APP_BEARER_TOKEN}" \
  -o niva-weekly-status.md \
  "${API_URL}/api/v1/weekly-report"
```

With a fixed `asOf`:

```bash
curl -fsS \
  -H "X-Serverless-Authorization: Bearer ${GOOGLE_IDENTITY_TOKEN}" \
  -H "Authorization: Bearer ${APP_BEARER_TOKEN}" \
  -o niva-weekly-status.md \
  "${API_URL}/api/v1/weekly-report?asOf=2026-07-19T22:00:00-04:00"
```

Do **not** use `--allow-unauthenticated` or omit Cloud Run IAM for these
examples. Bearer-token-only invocation is **not** an approved transport path.

---

## Out of scope for documentation-only / pre-deploy stages

- Creating Google Cloud resources or secrets
- Granting IAM or changing invoker bindings
- Deploying or updating either Cloud Run service
- Rebuilding images or running Cloud Build
- Invoking the API or minting real tokens for live calls
- Creating Google Docs or Google Drive files
- Cloud Scheduler / Sunday automation wiring
- MCP server or ChatGPT connector configuration
- Chart generation
- Rate limiting
- Write / Trello-mutation APIs
- Hidden-card parity with the dashboard
- Changes to `niva-mission-control`, IAP, dashboard revision/traffic, or the
  existing build trigger

The weekly-report **source** integration documents and implements the read-only
Markdown export route only. It does not deploy production automation or configure
downstream Docs / Drive / Scheduler consumers.
