export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Memuat" className="grid min-h-[60vh] place-items-center pt-24">
      <span className="spinner !size-7 text-accent" />
    </div>
  );
}
