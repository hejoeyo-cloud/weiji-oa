import requests, json

base = "http://localhost:8000/api"
# 登录
r = requests.post(f"{base}/auth/login", json={"username":"admin","password":"admin"})
token = r.json()["access_token"]
h = {"Authorization": f"Bearer {token}"}

# 查询审批列表
r = requests.get(f"{base}/approvals?page=1&page_size=50", headers=h)
data = r.json()
print(f"Total approvals: {data['total']}")
for item in data['items']:
    print(f"\n=== Approval #{item['id']} [{item['status']}] {item['title']} ===")
    print(f"  applicant: {item.get('applicant_name','?')} (id={item.get('applicant_id')})")
    for step in item.get('steps', []):
        print(f"  Step #{step['id']}: order={step['step_order']} "
              f"approver_id={step.get('approver_id')} "
              f"approver_name='{step.get('approver_name','')}' "
              f"status={step['status']}")
