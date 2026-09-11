import sys
import os
sys.path.append(os.path.abspath("llm-analyzer"))
from chain import RcaChain
try:
    chain = RcaChain(gemini_api_key="fake-key")
    print("SUCCESS")
except Exception as e:
    print("ERROR:", str(e))
