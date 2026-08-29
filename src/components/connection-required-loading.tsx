export function ConnectionRequiredLoading({ title }: { title: string }) {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-lg flex-1 px-5 pt-6 pb-10">
      <section className="border p-5">
        <h1 className="font-display text-[30px] uppercase">{title}</h1>
        <p role="status" className="mt-2 font-semibold text-muted-foreground">
          Contacting the server…
        </p>
      </section>
    </main>
  );
}
