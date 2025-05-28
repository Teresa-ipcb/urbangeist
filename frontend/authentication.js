async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('https://urbangeist-function.azurewebsites.net/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Guarda a sessão no localStorage
            localStorage.setItem("sessionId", data.sessionId);
            localStorage.setItem("user_email", data.email);
            localStorage.setItem("user_nome", data.nome);
            window.location.href = "../index.html";
        } else {
            alert(data || "Erro no login.");
        }
    } catch (err) {
        console.error("Erro:", err);
        alert("Erro de conexão com o servidor.");
    }
}


async function logout() {
    const sessionId = localStorage.getItem("sessionId");

    try {
        await fetch('https://urbangeist-function.azurewebsites.net/api/logout', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
    } catch (e) {
        console.warn("Erro ao chamar logout backend:", e);
    }

    localStorage.removeItem("sessionId");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_nome");
    window.location.href = "authentication.html";
}

