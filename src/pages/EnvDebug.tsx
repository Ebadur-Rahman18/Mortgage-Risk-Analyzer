/**
 * Environment Variables Debug Page
 * This page helps you verify that your environment variables are loaded correctly
 * 
 * To access: Navigate to /env-debug in your browser
 * This page should be removed or protected in production
 */

export default function EnvDebug() {
  const envVars = {
    'VITE_SUPABASE_URL': import.meta.env.VITE_SUPABASE_URL,
    'VITE_SUPABASE_PUBLISHABLE_KEY': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    'VITE_SUPABASE_PROJECT_ID': import.meta.env.VITE_SUPABASE_PROJECT_ID,
    'VITE_MICROSOFT_CLIENT_ID': import.meta.env.VITE_MICROSOFT_CLIENT_ID,
    'MODE': import.meta.env.MODE,
    'DEV': import.meta.env.DEV,
    'PROD': import.meta.env.PROD,
  };

  const hasSupabaseConfig = !!(
    import.meta.env.VITE_SUPABASE_URL && 
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Environment Variables Debug</h1>
      
      <div className={`p-4 rounded-lg mb-6 ${hasSupabaseConfig ? 'bg-green-100 border-green-500' : 'bg-red-100 border-red-500'} border-2`}>
        <h2 className="text-xl font-semibold mb-2">
          {hasSupabaseConfig ? '✅ Supabase Configuration: OK' : '❌ Supabase Configuration: MISSING'}
        </h2>
        {!hasSupabaseConfig && (
          <div className="text-red-700 mt-2">
            <p className="font-semibold">Fix Steps:</p>
            <ol className="list-decimal ml-6 mt-2 space-y-1">
              <li>Check that your <code className="bg-white px-2 py-1 rounded">.env</code> file exists in the project root</li>
              <li>Verify it contains <code className="bg-white px-2 py-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-white px-2 py-1 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code></li>
              <li><strong>Restart your dev server</strong> (Ctrl+C, then npm run dev)</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        )}
      </div>

      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Environment Variables:</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-2 px-4">Variable</th>
              <th className="text-left py-2 px-4">Status</th>
              <th className="text-left py-2 px-4">Value (truncated)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(envVars).map(([key, value]) => (
              <tr key={key} className="border-b border-gray-200">
                <td className="py-2 px-4 font-mono text-sm">{key}</td>
                <td className="py-2 px-4">
                  {value ? (
                    <span className="text-green-600 font-semibold">✓ Set</span>
                  ) : (
                    <span className="text-red-600 font-semibold">✗ Missing</span>
                  )}
                </td>
                <td className="py-2 px-4 font-mono text-xs">
                  {value ? (
                    typeof value === 'string' && value.length > 50 
                      ? `${value.substring(0, 50)}...` 
                      : String(value)
                  ) : (
                    <span className="text-gray-400">undefined</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Tips:</h3>
        <ul className="list-disc ml-6 space-y-1 text-blue-800">
          <li>Environment variables must start with <code className="bg-white px-2 py-1 rounded">VITE_</code> to be exposed to the client</li>
          <li>Changes to <code className="bg-white px-2 py-1 rounded">.env</code> require a dev server restart</li>
          <li>Never commit sensitive keys to version control</li>
          <li>This debug page should be removed in production</li>
        </ul>
      </div>

      <div className="mt-6">
        <a 
          href="/login" 
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          Go to Login
        </a>
      </div>
    </div>
  );
}
