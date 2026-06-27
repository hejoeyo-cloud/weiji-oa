"""微迹OA 高并发测试脚本"""
import asyncio
import aiohttp
import time
import statistics

BASE = "http://localhost:8000"
EMAIL = "admin@weiji.local"
PASSWORD = "admin"


async def get_token():
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{BASE}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}) as r:
            data = await r.json()
            return data["token"]


async def single_request(session, url, headers, results):
    start = time.monotonic()
    try:
        async with session.get(url, headers=headers) as resp:
            await resp.read()
            elapsed = (time.monotonic() - start) * 1000
            results.append({"status": resp.status, "ms": elapsed, "error": None})
    except Exception as e:
        elapsed = (time.monotonic() - start) * 1000
        results.append({"status": 0, "ms": elapsed, "error": str(e)})


async def run_test(name, url, total, concurrency, token):
    headers = {"Authorization": f"Bearer {token}"}
    results = []
    connector = aiohttp.TCPConnector(limit=concurrency)
    async with aiohttp.ClientSession(connector=connector) as session:
        semaphore = asyncio.Semaphore(concurrency)

        async def limited_request():
            async with semaphore:
                await single_request(session, url, headers, results)

        start = time.monotonic()
        tasks = [limited_request() for _ in range(total)]
        await asyncio.gather(*tasks)
        total_time = (time.monotonic() - start) * 1000

    # 分析结果
    statuses = [r["status"] for r in results]
    times = [r["ms"] for r in results]
    errors = [r for r in results if r["error"] or r["status"] >= 500]
    rate_limited = [r for r in results if r["status"] == 429]

    success = [t for t, s in zip(times, statuses) if 200 <= s < 300]

    print(f"\n{'='*50}")
    print(f"  {name}")
    print(f"{'='*50}")
    print(f"  总请求数:     {total}")
    print(f"  并发数:       {concurrency}")
    print(f"  总耗时:       {total_time:.0f}ms")
    print(f"  QPS:          {total / (total_time/1000):.0f}")
    print(f"  成功(2xx):    {len(success)}")
    print(f"  速率限制(429):{len(rate_limited)}")
    print(f"  服务端错误:   {len(errors)}")

    if success:
        print(f"  --- 成功请求延迟 ---")
        print(f"  平均:         {statistics.mean(success):.1f}ms")
        print(f"  中位数:       {statistics.median(success):.1f}ms")
        print(f"  P95:          {sorted(success)[int(len(success)*0.95)]:.1f}ms")
        print(f"  P99:          {sorted(success)[int(len(success)*0.99)]:.1f}ms")
        print(f"  最大:         {max(success):.1f}ms")
        print(f"  最小:         {min(success):.1f}ms")


async def main():
    print("微迹OA 高并发性能测试")
    print("=" * 50)

    token = await get_token()
    print(f"Token 获取成功")

    # 测试1: 登录接口（无速率限制？）
    await run_test(
        "登录接口",
        f"{BASE}/api/auth/login",
        total=200, concurrency=20, token=token
    )

    # 测试2: 工单列表（中等负载）
    await run_test(
        "工单列表 - 20并发",
        f"{BASE}/api/tickets?page=1&page_size=15",
        total=200, concurrency=20, token=token
    )

    # 测试3: 产品列表
    await run_test(
        "产品列表 - 20并发",
        f"{BASE}/api/products?page=1&page_size=20",
        total=200, concurrency=20, token=token
    )

    # 测试4: 报表接口（重查询）
    await run_test(
        "报表概览 - 20并发",
        f"{BASE}/api/reports/overview?year=2026",
        total=100, concurrency=20, token=token
    )

    # 测试5: 知识库
    await run_test(
        "知识库文章 - 20并发",
        f"{BASE}/api/knowledge/articles?page=1&page_size=20",
        total=200, concurrency=20, token=token
    )

    # 测试6: 客户画像（新增接口）
    await run_test(
        "客户画像 - 20并发",
        f"{BASE}/api/customers/test123/profile",
        total=100, concurrency=20, token=token
    )

    # 测试7: 高并发压测工单
    await run_test(
        "工单列表 - 50并发 高压",
        f"{BASE}/api/tickets?page=1&page_size=15",
        total=500, concurrency=50, token=token
    )


if __name__ == "__main__":
    asyncio.run(main())
