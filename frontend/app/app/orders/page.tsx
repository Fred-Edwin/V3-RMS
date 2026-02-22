export default function Page(): JSX.Element {
  return (
    <main className="min-h-screen p-6 md:p-8">
      <section className="mx-auto max-w-3xl rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-label-sm uppercase tracking-wide text-stone-500">Phase 0 Placeholder</p>
        <h1 className="mt-2 font-sans text-heading-lg text-espresso">Orders</h1>
        <p className="mt-2 text-body-md text-stone-700">Route: <code>/app/orders</code></p>
      </section>
    </main>
  );
}
