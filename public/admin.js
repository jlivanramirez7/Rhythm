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
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user.id}</td>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${user.is_admin ? 'Yes' : 'No'}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        usersContainer.innerHTML = '';
        usersContainer.appendChild(table);
    };

    fetchAndRenderUsers();
});
