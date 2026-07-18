========================================
  WeiJi OA System - Deployment Guide
========================================

System Requirements
-------------------
- Windows 10/11 or Windows Server 2016+
- Python 3.10 or newer
- At least 512MB free disk space

Quick Start
-----------
1. Double-click install.bat to install dependencies
   (Internet connection required for first-time setup)

2. Place your license.lic file in this folder
   (If you don't have one, contact your vendor)

3. Double-click start.bat to launch the server

4. Open http://localhost:8000 in your browser

   To access from other devices on the same network:
   http://<this-computer-ip>:8000

Default Login
-------------
Email:    admin@weiji.local
Password: admin

IMPORTANT: Change the admin password after first login.

File Structure
--------------
install.bat       One-click dependency setup
start.bat         Launch the application server
backend/          Python backend source code
frontend/dist/    Frontend web application
tools/            License generation utilities

Support
-------
For technical support, contact your software vendor.
