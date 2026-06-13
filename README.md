# Wormcup - Penalty Shootout Game

৭ শট পেনাল্টি গেইম, টাস্ক-বেসড রিওয়ার্ড সিস্টেম, MongoDB persistence, Render-ready।

## ফিচার

- প্রতি টাস্কে ৭টা পেনাল্টি শট
- টাস্ক রিওয়ার্ড / ৭ = প্রতি গোলে রিওয়ার্ড
- সার্ভার-সাইড র‍্যান্ডম গোলকিপার লজিক (anti-cheat)
- অ্যানিমেটেড স্টেডিয়াম, বল, গোলকিপার ডাইভ
- শট হিস্টোরি, রিওয়ার্ড ট্র্যাকিং
- ক্লেইম সিস্টেম (একবারই ক্লেইম করা যাবে)
- টাস্ক ২৪ ঘন্টা পর অটো এক্সপায়ার (MongoDB TTL index)

## লোকাল সেটআপ

```bash
npm install
cp .env.example .env
# .env এ MONGODB_URI বসান
npm start
```

## Render এ Deploy

1. এই কোড GitHub repo-তে পুশ করুন
2. Render.com → New → Web Service → আপনার repo সিলেক্ট করুন
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Environment Variables এ যুক্ত করুন:
   - `MONGODB_URI` = আপনার MongoDB Atlas connection string
   - `ADMIN_SECRET` (ভবিষ্যতের জন্য, এখন ব্যবহৃত হয়নি)

Deploy হয়ে গেলে আপনার URL হবে: `https://your-app-name.onrender.com`

## API Endpoints

### ১. টাস্ক তৈরি (বট থেকে কল করুন)

```
POST /api/task/create
Content-Type: application/json

{
  "userId": "123456789",
  "totalReward": 0.07,
  "botToken": "your_bot_identifier"
}
```

রেসপন্স:
```json
{
  "success": true,
  "taskId": "a1b2c3d4e5f6g7h8",
  "gameUrl": "https://your-app.onrender.com/?task=a1b2c3d4e5f6g7h8",
  "perShotReward": 0.01,
  "totalReward": 0.07
}
```

`gameUrl` টা বটে বাটন লিংক হিসেবে দিন।

### ২. টাস্ক স্ট্যাটাস (ফ্রন্টএন্ড নিজে কল করে)

```
GET /api/task/:taskId
```

### ৩. শট নেওয়া (ফ্রন্টএন্ড নিজে কল করে)

```
POST /api/task/:taskId/shot
{ "direction": "top-left" }
```

`direction` এর সম্ভাব্য মান: `top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, `bottom-right`

### ৪. রিওয়ার্ড ক্লেইম (ফ্রন্টএন্ড নিজে কল করে, ৭ শট শেষে)

```
POST /api/task/:taskId/claim
```

রেসপন্স:
```json
{
  "success": true,
  "userId": "123456789",
  "earnedAmount": 0.04,
  "taskId": "a1b2c3d4e5f6g7h8"
}
```

## BJS বট ইন্টিগ্রেশন

### Step 1: বটে একটা কমান্ড/বাটন বানান যা টাস্ক তৈরি করবে

BJS তে HTTP request module দিয়ে `POST /api/task/create` কল করুন, যেখানে:
- `userId` = টেলিগ্রাম ইউজারের আইডি
- `totalReward` = আপনার টাস্কের রিওয়ার্ড amount

রেসপন্স থেকে `gameUrl` নিয়ে inline button এ URL হিসেবে সেট করুন (button type: URL/Web App)।

### Step 2: ব্যালেন্স আপডেট

`server.js` এর `/api/task/:taskId/claim` রুটে একটা `TODO` কমেন্ট আছে — সেখানে আপনার বটের ব্যালেন্স আপডেট করার জন্য:

**অপশন A:** আপনার BJS বটে একটা ওয়েবহুক/HTTP endpoint বানান যেটা userId ও amount নিয়ে ব্যালেন্স যুক্ত করে, তারপর claim রুট থেকে সেই endpoint কল করুন।

**অপশন B:** MongoDB-তে সরাসরি ইউজার ব্যালেন্স কালেকশন আপডেট করুন (যদি বট ও এই অ্যাপ একই ডাটাবেস শেয়ার করে)।

উদাহরণ (claim রুটে যুক্ত করুন):
```javascript
// MongoDB এর users কালেকশনে ব্যালেন্স বাড়ান
await mongoose.connection.db.collection('users').updateOne(
  { userId: task.userId },
  { $inc: { balance: task.earnedAmount } }
);
```

অথবা আপনার বটের নোটিফিকেশন/ওয়েবহুক:
```javascript
await fetch('https://your-bot-webhook-url.com/credit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: task.userId, amount: task.earnedAmount, taskId: task.taskId })
});
```

## গেইম লজিক

- গোলকিপার র‍্যান্ডমভাবে ৬টা জোনের একটায় ডাইভ দেয়
- যদি গোলকিপারের জোন = আপনার শটের জোন → ৭০% সম্ভাবনায় সেভ
- যদি না মিলে → ৮৮% সম্ভাবনায় গোল
- প্রতিটা গোলে `totalReward / 7` রিওয়ার্ড যুক্ত হয়
- ৭ শট শেষে ক্লেইম বাটন একটিভ হয়, ক্লেইম করলে ব্যালেন্সে যুক্ত হবে

## কাস্টমাইজেশন

- শট সংখ্যা পরিবর্তন: `models/Task.js` এর `shotsRequired` ডিফল্ট ভ্যালু (server.js এর create রুটেও পরিবর্তন করুন)
- সেভ প্রবাবিলিটি: `server.js` এর `/shot` রুটে `0.70` ও `0.12` ভ্যালু এডিট করুন
- কালার থিম: `style.css` এ `#ffd23f` (yellow accent) ও `#0d4a2c` (green) সার্চ করে পরিবর্তন করুন
- টাস্ক এক্সপায়ারি টাইম: `models/Task.js` এর `expires: 86400` (সেকেন্ডে)
