CAVIARQR KITCHEN TENANT ISOLATION FIX
====================================

WHAT THIS FIX CLOSES
--------------------
1. Removes the cafe1/businessId=3 hard-coding from the kitchen dashboard.
2. Kitchen login now receives a signed server-issued kitchen token.
3. The dashboard asks /kitchen-auth/me for its authoritative cafe identity.
   localStorage is only a cache; it no longer decides which cafe is logged in.
4. Active/history order APIs do not accept a storeCode/businessId from the browser.
   They use the signed kitchen identity on the server.
5. Order status updates first verify that the order belongs to the signed cafe.
6. Socket.IO ignores client-supplied businessId. The signed token decides the room.
7. kitchenAck verifies orderId + businessId + storeCode before updating anything.
8. Frontend also rejects any socket/order payload that does not match its signed cafe.
9. Kitchen devices no longer execute the old direct refund endpoint; refunds remain in
   the audited Action Center flow.
10. Production passwordless kitchen login is rejected. Set a kitchen password first.

INSTALL (RECOMMENDED)
---------------------
1. Extract this folder anywhere, e.g. Downloads\caviarqr-kitchen-tenant-isolation
2. Open PowerShell in the extracted folder.
3. Run:

   Set-ExecutionPolicy -Scope Process Bypass
   .\apply-fix.ps1 -ProjectRoot C:\sanjithnfcbarcode

The installer creates a backup folder in C:\sanjithnfcbarcode before changing files.
It also creates KITCHEN_TOKEN_SECRET in backend\.env if one is not already present.
The generated secret is NOT printed.

4. Restart backend:

   cd C:\sanjithnfcbarcode\backend
   npm run start:dev

5. Restart frontend:

   cd C:\sanjithnfcbarcode\web
   npm run dev

6. Log out of the kitchen and log in again. Old sessions should not be reused.

TEST BEFORE HOSTING
-------------------
A. Login cafe1 kitchen in Browser A.
B. Login cafe2 kitchen in Incognito/Browser B.
C. Place one cafe1 test order and one cafe2 test order.
D. Confirm:
   - cafe1 sees ONLY cafe1 order
   - cafe2 sees ONLY cafe2 order
   - completing cafe1 order never changes cafe2
   - backend logs show each kitchen joins a different business-* socket room

SECURITY TEST
-------------
After cafe2 login, manually changing localStorage storeCode/businessId to cafe1 must NOT
show cafe1 orders. Refreshing the page causes /kitchen-auth/me to restore cafe2 from the
signed token. Calling another cafe's order id through the secure status endpoint returns
404 rather than modifying it.

NO DATABASE MIGRATION IS REQUIRED.

PRODUCTION
----------
Use a dedicated KITCHEN_TOKEN_SECRET (48+ random bytes is recommended). The included
installer generates one locally. Do not paste that secret into chat or source control.
Rotate any previously exposed development secrets before production deployment.
