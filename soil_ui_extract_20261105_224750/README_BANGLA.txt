আমাদের কৃষি AI — Soil Intelligence UI Fix
========================================

এই ZIP-এ তিনটি ফাইল আছে:
frontend/src/components/workspace/SoilHealthDashboard.tsx
frontend/src/components/workspace/soil/SoilIntelligenceRedesign.tsx
frontend/src/components/workspace/soil/SoilTestForm.tsx

কাজ:
- Lovable 05_soil_intelligence_reference.png-এর দুই-কলামের কার্ড Layout-এর কাছাকাছি UI।
- নির্বাচিত ফার্মের বাস্তব SoilTest ডেটা দেখায়।
- SoilTest না থাকলেও গুছানো Empty State ও Add Soil Test Button থাকবে।
- Button-এ Click করলে বাস্তব Form খুলবে।
- Save করলে existing soilApi.createSoilTest ব্যবহার হবে; Save সফল হলে List আবার Load হবে।
- কোনো কাল্পনিক NPK Percentage বা সারের নির্দেশনা নেই।

Windows-এ Install:
1. AgriSphere-AI Project-এর একটি Backup রাখুন।
2. ZIP Extract করুন।
3. Extract করা 'frontend' Folder-এর ভেতর থেকে ৩টি TSX ফাইল একই Relative Path-এ Project-এর মধ্যে Copy/Replace করুন।
   Project-এর পুরো frontend Directory বা অন্যান্য ফাইল Replace করবেন না।
4. PowerShell-এ চালান:
   cd "C:\Users\hp\OneDrive\Documents\Desktop\AgriSphere-AI\frontend"
   npm run build
   Write-Host "BUILD_EXIT_CODE=$LASTEXITCODE"
5. Build PASS হলে Local Browser-এ /workspace?tab=soil_health খুলে Button, Form এবং Farm Switch পরীক্ষা করুন।
6. Test Data দিয়ে Main Database-এ Save করবেন না; শুধু Form ওপেন/ক্যানসেল করে দেখুন।

সীমাবদ্ধতা:
- এখানে সম্পূর্ণ User Project নেই; তাই এই ZIP থেকে Project-এর আসল Production Build বা Browser Test সম্পন্ন করা সম্ভব হয়নি।
- এখানে দেওয়া SoilTestCreatePayload ও soilApi.createSoilTest, getFarmSoilTests user-এর দেওয়া বর্তমান Type/API থেকে নেওয়া।
- Existing edit/delete controls এই নতুন Overview-তে তৈরি করা হয়নি; শুধু Add ও History Display আছে।
