export default function Home() {
  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>ERP Forge</h1>
      <p>Platform API is running.</p>
      <ul>
        <li>
          <a href="/api/health">GET /api/health</a>
        </li>
      </ul>
    </main>
  );
}
