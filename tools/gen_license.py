"""授权文件生成工具 —— 在你自己的电脑上运行

用法:
  python gen_license.py --company "公司名" --expire "2027-06-25" --fingerprint "xxx"

可选参数:
  --users 50           最大用户数（默认不限制）
  --modules "a,b,c"    开通模块（默认全部）
"""
import argparse
import json
import os
import sys

# 让脚本可以引用同级目录
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

KEY_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "keys")


def load_private_key():
    path = os.path.join(KEY_DIR, "private.pem")
    if not os.path.exists(path):
        print(f"错误：找不到私钥文件 {path}")
        print("请先运行: python tools/rsa_keygen.py")
        sys.exit(1)
    with open(path, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)


def main():
    parser = argparse.ArgumentParser(description="生成授权文件 license.lic")
    parser.add_argument("--company", required=True, help="授权公司名称")
    parser.add_argument("--expire", required=True, help="到期日期，格式 YYYY-MM-DD")
    parser.add_argument("--fingerprint", required=True, help="机器指纹（由系统生成）")
    parser.add_argument("--users", type=int, default=0, help="最大用户数，0=不限")
    parser.add_argument("--modules", default="", help="开通模块，逗号分隔，空=全部")
    parser.add_argument("--output", default="license.lic", help="输出文件名")
    args = parser.parse_args()

    payload = {
        "company": args.company,
        "issued_at": __import__("datetime").date.today().isoformat(),
        "expires_at": args.expire,
        "max_users": args.users,
        "modules": [m.strip() for m in args.modules.split(",") if m.strip()] if args.modules else [],
        "machine_fingerprint": args.fingerprint,
    }

    private_key = load_private_key()
    data = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()
    signature = private_key.sign(data, padding.PKCS1v15(), hashes.SHA256())

    import base64
    license_obj = {
        "payload": payload,
        "signature": base64.b64encode(signature).decode(),
    }

    output_path = args.output
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(license_obj, f, ensure_ascii=False, indent=2)

    print(f"授权文件已生成: {output_path}")
    print(f"公司: {args.company}")
    print(f"到期: {args.expire}")
    print(f"用户限制: {'不限' if args.users == 0 else args.users}")
    print(f"模块: {'全部' if not args.modules else args.modules}")


if __name__ == "__main__":
    main()
