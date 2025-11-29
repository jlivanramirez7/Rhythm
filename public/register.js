document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const messageElement = document.getElementById('message');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Registration form submitted.');

        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        console.log('Submitting with name:', name, 'and email:', email);

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email }),
            });

            if (response.ok) {
                console.log('Registration request successful.');
                messageElement.textContent = 'Registration successful! Please wait for admin approval.';
                messageElement.style.color = 'green';
                registerForm.reset();
            } else {
                const error = await response.json();
                console.error('Registration request failed:', error);
                throw new Error(error.error || 'Registration failed.');
            }
        } catch (error) {
            console.error('An error occurred during form submission:', error);
            messageElement.textContent = error.message;
            messageElement.style.color = 'red';
        }
    });
});
