document.addEventListener('DOMContentLoaded', async () => {
    const appMenuToggle = document.getElementById('app-menu-toggle');
    const appMenuContent = document.getElementById('app-menu-content');

    if (appMenuToggle && appMenuContent) {
        appMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            appMenuToggle.classList.toggle('active');
            appMenuContent.classList.toggle('active');
        });

        document.addEventListener('click', (event) => {
            if (!appMenuContent.contains(event.target) && !appMenuToggle.contains(event.target)) {
                appMenuToggle.classList.remove('active');
                appMenuContent.classList.remove('active');
            }
        });
    }

    const showInstructionsCheckbox = document.getElementById('show-instructions-checkbox');
    const shareForm = document.getElementById('share-form');
    const deleteDataButton = document.getElementById('delete-data-button');

    // Fetch user settings and populate the form
    try {
        const res = await fetch('/api/me');
        const user = await res.json();
        showInstructionsCheckbox.checked = user.show_instructions;
    } catch (error) {
        console.error('Error fetching user settings:', error);
    }

    // Update user settings when the checkbox is changed
    showInstructionsCheckbox.addEventListener('change', async () => {
        const show_instructions = showInstructionsCheckbox.checked;
        console.log(`[ACCOUNT.JS] Checkbox changed. New value: ${show_instructions}. Sending to backend...`);
        try {
            const response = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ show_instructions }),
            });
            if (response.ok) {
                console.log('[ACCOUNT.JS] Backend successfully updated settings.');
            } else {
                console.error('[ACCOUNT.JS] Backend failed to update settings.');
            }
        } catch (error) {
            console.error('Error updating user settings:', error);
        }
    });

    // Handle the "Share Your Data" form submission
    shareForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageElement = document.getElementById('share-message');
        const email = document.getElementById('partner-email').value;

        try {
            const response = await fetch('/api/partner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const result = await response.json();
            if (response.ok) {
                messageElement.textContent = result.message;
                messageElement.style.color = 'green';
                shareForm.reset();
            } else {
                throw new Error(result.error || 'Failed to share data.');
            }
        } catch (error) {
            messageElement.textContent = error.message;
            messageElement.style.color = 'red';
        }
    });

    // Handle the "Delete All My Data" button click
    deleteDataButton.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete all your data? This action is irreversible.')) {
            try {
                const response = await fetch('/api/data', { method: 'DELETE' });
                if (response.ok) {
                    alert('All your data has been deleted.');
                    window.location.href = '/';
                } else {
                    throw new Error('Failed to delete data.');
                }
            } catch (error) {
                console.error('Error deleting data:', error);
                alert(error.message);
            }
        }
    });
});
