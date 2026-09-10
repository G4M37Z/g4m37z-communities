export default async function CreatorPage({ params }: { params: Promise<{ id: string }> }) { const { id }=await params; return <main><h1>Creator {id}</h1></main>; }
