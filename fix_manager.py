# Set admin's is_manager=True so they appear in approval users
import sys
sys.path.insert(0, 'c:/Users/admin/Desktop/项目/backend')
from database import SessionLocal, User

db = SessionLocal()
admin = db.query(User).filter(User.username == 'admin').first()
if admin:
    admin.is_manager = True
    db.commit()
    print(f"admin is_manager set to True")
else:
    print("admin not found")
db.close()
</parameter>
</parameter name="exe="Write"/>
<parameter name="target_file">c:\Users\admin\Desktop\项目\fix_manager.py