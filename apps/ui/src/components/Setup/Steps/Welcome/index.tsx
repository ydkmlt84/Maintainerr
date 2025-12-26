export default function WelcomeStep() {
  return (
    <div className="px-4 pb-6">
      <h2 className="text-center text-2xl font-semibold text-zinc-100">
        Your library is about to get a whole lot cleaner!
      </h2>

      <p className="mt-3 pb-4 text-center text-zinc-300">
        Plex is the only <i>required</i> service. Maintainerr will not function
        without a Plex server setup.
      </p>

      <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900/40 p-4">
        <div className="text-sm font-semibold text-zinc-200">Next Steps:</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-300">
          <li>Authenticate with Plex</li>
          <li>Pick your Plex server</li>
          <li>Test the connection. Then save it.</li>
          <li>
            <i>Optional</i> - Setup other services
          </li>
          <li>Continue on to Maintainerr</li>
        </ul>
      </div>
    </div>
  )
}
