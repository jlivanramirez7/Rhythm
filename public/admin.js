document.addEventListener('DOMContentLoaded', () => {
    const usersContainer = document.getElementById('users-container');

    const fetchAndRenderUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            if (!res.ok) {
                throw new Error('Failed to fetch users.');
            }
            const users = await res.json();
            renderUsers(users);
        } catch (error) {
            console.error('Error fetching users:', error);
            usersContainer.innerHTML = '<p>Could not load user data.</p>';
        }
    };

    const renderUsers = (users) => {
        if (!users || users.length === 0) {
            usersContainer.innerHTML = '<p>No users found.</p>';
            return;
        }

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Admin</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user.id}</td>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${user.is_admin ? 'Yes' : 'No'}</td>
                        <td>${user.approved ? 'Approved' : 'Pending'}</td>
                        <td>
                            ${!user.approved ? `
                                <button class="approve-btn" data-id="${user.id}">Approve</button>
                                <button class="reject-btn" data-id="${user.id}">Reject</button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        usersContainer.innerHTML = '';
        usersContainer.appendChild(table);

        // Add event listeners for the new buttons
        document.querySelectorAll('.approve-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                await fetch(`/api/admin/users/approve/${id}`, { method: 'POST' });
                fetchAndRenderUsers();
            });
        });

        document.querySelectorAll('.reject-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                if (confirm('Are you sure you want to reject and delete this user?')) {
                    const id = e.target.dataset.id;
                    await fetch(`/api/admin/users/reject/${id}`, { method: 'DELETE' });
                    fetchAndRenderUsers();
                }
            });
        });
    };

    fetchAndRenderUsers();
});
