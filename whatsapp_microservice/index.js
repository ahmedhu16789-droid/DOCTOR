const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode'); // استبدلنا qrcode-terminal بـ qrcode
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const port = 3001;

// متغيرات لتخزين حالة الـ QR والاتصال
let currentQR = '';
let connectionStatus = 'جاري التهيئة...';

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "client-one" }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
    }
});

// عند طلب الـ QR Code لأول مرة
client.on('qr', (qr) => {
    console.log('تم استلام QR جديد.');
    connectionStatus = 'في انتظار المسح...';
    // تحويل الـ QR النصي إلى صورة Base64 لتسهيل عرضها في المتصفح
    qrcode.toDataURL(qr, (err, url) => {
        if (!err) {
            currentQR = url;
        }
    });
});

// عندما ينجح الاتصال
client.on('ready', () => {
    console.log('✅ تم الاتصال بنجاح!');
    connectionStatus = 'تم الاتصال بنجاح ✅';
    currentQR = ''; // إخفاء الـ QR بعد الاتصال
});

client.on('authenticated', () => {
    console.log('🔐 تمت المصادقة بنجاح.');
});

client.on('disconnected', (reason) => {
    console.log('❌ تم قطع الاتصال:', reason);
    connectionStatus = 'تم قطع الاتصال';
    currentQR = '';
});

// بدء تشغيل العميل
client.initialize();


// ==========================================
// مسارات العرض في المتصفح (Frontend بسيط جداً)
// ==========================================

// مسار لعرض صفحة الـ HTML
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WhatsApp Microservice</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; background-color: #f0f2f5; padding: 50px; }
            .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px; margin: auto; }
            h1 { color: #25D366; }
            #qr-image { width: 250px; height: 250px; margin: 20px auto; border: 1px solid #ddd; padding: 10px; border-radius: 10px; display: none; }
            .status { font-size: 18px; font-weight: bold; margin-bottom: 20px; color: #555; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>واتساب سيرفر</h1>
            <div class="status" id="status-text">جاري التحميل...</div>
            <img id="qr-image" src="" alt="QR Code">
        </div>

        <script>
            // دالة لجلب حالة الـ QR والاتصال كل ثانيتين
            async function fetchStatus() {
                try {
                    const response = await fetch('/api/status');
                    const data = await response.json();
                    
                    document.getElementById('status-text').innerText = data.status;
                    
                    const qrImg = document.getElementById('qr-image');
                    if (data.qr) {
                        qrImg.src = data.qr;
                        qrImg.style.display = 'block';
                    } else {
                        qrImg.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error fetching status:', error);
                }
            }
            
            setInterval(fetchStatus, 2000);
            fetchStatus();
        </script>
    </body>
    </html>
    `);
});

// مسار للـ API يزود المتصفح بحالة الـ QR
app.get('/api/status', (req, res) => {
    res.json({
        status: connectionStatus,
        qr: currentQR
    });
});


// ==========================================
// مسار إرسال الرسائل (الـ API الأساسي)
// ==========================================
app.post('/api/send-message', async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ status: 'error', message: 'رقم الهاتف والرسالة مطلوبان' });
    }

    if (connectionStatus !== 'تم الاتصال بنجاح ✅') {
        return res.status(503).json({ status: 'error', message: 'رقم الواتساب غير متصل حالياً' });
    }

    let formattedPhone = phone;
    if (formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.substring(1);
    }

    const chatId = `${formattedPhone}@c.us`;

    try {
        await client.sendMessage(chatId, message);
        console.log(`📩 تم إرسال رسالة إلى ${formattedPhone}`);
        res.status(200).json({ status: 'success', message: 'تم إرسال الرسالة بنجاح' });
    } catch (error) {
        console.error('❌ خطأ في إرسال الرسالة:', error);
        res.status(500).json({ status: 'error', message: 'فشل إرسال الرسالة', error: error.toString() });
    }
});

// تشغيل سيرفر الـ Node.js
app.listen(port, () => {
    console.log(`🚀 خدمة WhatsApp تعمل الآن.`);
    console.log(`👉 افتح المتصفح على: http://localhost:${port} لمشاهدة الـ QR Code.`);
});
