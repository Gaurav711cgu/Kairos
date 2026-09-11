import sys
content = open("llm-analyzer/models.py").read()
content = content.replace("    root_cause: RootCause\n", "    root_cause: RootCause = Field(description=\"The primary root cause identified in the trace\")\n")
content = content.replace("    primary_fix: CodeFix\n", "    primary_fix: CodeFix = Field(description=\"The primary fix for the root cause\")\n")
content = content.replace("    severity: Literal[\"LOW\", \"MEDIUM\", \"HIGH\", \"CRITICAL\"] = \"HIGH\"\n", "    severity: Literal[\"LOW\", \"MEDIUM\", \"HIGH\", \"CRITICAL\"] = Field(default=\"HIGH\", description=\"Severity of the issue\")\n")
content = content.replace("    schema_version: int = 1\n", "    schema_version: int = Field(default=1, description=\"Schema version\")\n")
open("llm-analyzer/models.py", "w").write(content)
