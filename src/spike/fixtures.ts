import type { Finding } from '@/lib/llm/translator';

export const PYTHON_SAMPLE = `import subprocess
import pandas as pd

def unsafe_run(cmd):
    # shell=True is dangerous: command injection
    return subprocess.run(cmd, shell=True)

def fake_method_call(df):
    # this method doesn't exist (LLM hallucination)
    return df.read_excel_advanced("file.xlsx")

unused_var = 42
def f():
    pass
`;

export const TYPESCRIPT_SAMPLE = `const user = { name: "alice" };

// loose equality
if (user.name == undefined) {
  console.log("no name");
}

// using eval — security risk
eval("console.log('hi')");

// unused variable
const SECRET = "sk-abc123";

debugger;
`;

export const HTML_SAMPLE = `<!doctype html><html><head><title>messy</title></head><body><div    class="foo"   ><p>hi<img src="a.png"></p></div></body></html>`;

export const SAMPLE_FINDING: Finding = {
  ruleId: 'S605',
  rawMessage: 'Starting a process with a shell, possible injection detected',
  codeSnippet: 'return subprocess.run(cmd, shell=True)',
  language: 'python',
};
