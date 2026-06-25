"""获取本机机器指纹 —— 在部署机器上运行

用法:
  python tools/get_fingerprint.py

把输出的指纹发给授权方即可。
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from license import get_fingerprint

if __name__ == "__main__":
    fp = get_fingerprint()
    print(f"\n本机机器指纹: {fp}\n")
    print("请将此指纹发送给授权方以获取 license.lic 文件。")
