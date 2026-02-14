# CareerGPT - Local Setup Guide

## Prerequisites
1. Node.js 18+ installed
2. MongoDB installed locally OR MongoDB Atlas account
3. OpenAI API Key (get from https://platform.openai.com/api-keys)

## Step 1: Create Project Folder
```bash
mkdir careergpt
cd careergpt
```

## Step 2: Initialize Project
```bash
npx create-next-app@latest . --typescript=no --tailwind --eslint --app --src-dir=no --import-alias="@/*"
```

## Step 3: Install Dependencies
```bash
npm install mongodb uuid openai bcryptjs jsonwebtoken pdf-parse jspdf react-markdown remark-gfm
npm install @radix-ui/react-scroll-area @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-progress
npm install lucide-react class-variance-authority clsx tailwind-merge
```

## Step 4: Create .env file
Create a file named `.env` in the root folder:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=careergpt
OPENAI_API_KEY=your_openai_api_key_here
JWT_SECRET=your_secret_key_here_make_it_long_and_random
```

## Step 5: Copy the Code Files
- Copy `page.js` to `app/page.js`
- Copy `route.js` to `app/api/[[...path]]/route.js`
- Copy `layout.js` to `app/layout.js`

## Step 6: Run MongoDB
If using local MongoDB:
```bash
mongod --dbpath /path/to/your/data
```

Or use MongoDB Atlas (cloud) - update MONGO_URL in .env

## Step 7: Start the Application
```bash
npm run dev
```

## Step 8: Access the Application
Open browser: http://localhost:3000

## Troubleshooting
- If MongoDB connection fails, check if MongoDB is running
- If AI features don't work, verify your OpenAI API key
- For PDF upload issues, ensure pdf-parse is installed

## Project Features to Demonstrate
1. User Registration & Login (JWT Authentication)
2. AI Career Chat (Multi-model synthesis)
3. Resume Analyzer with ATS Scoring
4. Career Path Generator
5. Mock Interview with Voice Input
6. Job Matching Algorithm
7. Analytics Dashboard
