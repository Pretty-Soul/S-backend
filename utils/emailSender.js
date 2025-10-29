const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Updated function to accept a link
const sendVerificationEmail = async (toEmail, link) => {
    const mailOptions = {
        from: `"Susegad Supplies" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Verify Your Email for Susegad Supplies',
        // Updated email body with the link
        text: `Please verify your email address by clicking the following link:\n\n${link}\n\nThis link expires in 1 hour. If you did not sign up, please ignore this email.`,
        html: `<p>Please verify your email address by clicking the link below:</p><p><a href="${link}">Verify Email</a></p><p>This link expires in 1 hour. If you did not sign up, please ignore this email.</p>`
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Verification email sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending verification email:', error);
        return false;
    }
};

module.exports = { sendVerificationEmail };