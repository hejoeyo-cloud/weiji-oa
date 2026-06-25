"""RSA 密钥对生成工具 —— 仅在你自己的电脑上运行一次"""
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization
import os

KEY_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "keys")


def generate():
    os.makedirs(KEY_DIR, exist_ok=True)

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()

    # 私钥 —— 只有你保管，绝不外泄
    priv_path = os.path.join(KEY_DIR, "private.pem")
    with open(priv_path, "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ))
    print(f"私钥已生成: {priv_path}")

    # 公钥 —— 写入代码，随项目分发
    pub_path = os.path.join(KEY_DIR, "public.pem")
    with open(pub_path, "wb") as f:
        f.write(public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ))
    print(f"公钥已生成: {pub_path}")
    print("\n重要提示：private.pem 绝对不要提交到 git 或分发给任何人！")


if __name__ == "__main__":
    generate()
