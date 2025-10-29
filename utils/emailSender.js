const nodemailer = require('nodemailer');

// Configure the transporter using environment variables
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use Gmail service
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address from .env
        pass: process.env.EMAIL_PASS  // Your Gmail password or App Password from .env
    }
});

const sendVerificationEmail = async (toEmail, code) => {
    const mailOptions = {
        from: `"Susegad Supplies" <${process.env.EMAIL_USER}>`, // Sender address (shows your email)
        to: toEmail, // List of receivers (the user's email)
        subject: 'Verify Your Email for Susegad Supplies', // Subject line
        text: `Your verification code is: ${code}\nThis code expires in 15 minutes.`, // Plain text body
        html: `<strong>Your verification code is: ${code}</strong><p>This code expires in 15 minutes.</p>` // HTML body
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Verification email sent: %s', info.messageId);
        return true; // Indicate success
    } catch (error) {
        console.error('Error sending verification email:', error);
        return false; // Indicate failure
    }
};

module.exports = { sendVerificationEmail };