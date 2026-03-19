# CampusCoin XAMPP Setup

1. Copy this project into your XAMPP web root, for example `C:\xampp\htdocs\CampusCoin`.
2. Start `Apache` and `MySQL` from the XAMPP Control Panel.
3. Open `phpMyAdmin`, then import [database/campuscoin.sql](C:\Users\user\OneDrive\Documents\2026 Spring\CampusCoin\database\campuscoin.sql).
4. Update [api/config.php](C:\Users\user\OneDrive\Documents\2026 Spring\CampusCoin\api\config.php) if your MySQL username, password, or database name is different.
5. In Firebase Authentication, enable `Email/Password`.
6. Visit `http://localhost/CampusCoin/` and sign up.
7. If you want an admin account, change that user's `role` in the `users` table from `student` to `admin`.

How this version works:

- Firebase handles sign up and login in the browser.
- MySQL stores the app's `users`, `income`, and `expenses`.
- `income.user_id` and `expenses.user_id` both link each record to a row in `users`.
- The PHP API just syncs the Firebase user into MySQL and reads/writes income and expense data.

Notes:

- The frontend now expects the PHP API under `/api/...`.
- Pretty URLs such as `/api/records` depend on Apache `mod_rewrite` being enabled in XAMPP.
- This simplified version is easier to explain, but it does not verify Firebase tokens on the PHP side.
