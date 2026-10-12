-- Batasi upload bukti pembayaran di Supabase Storage menjadi 2 MiB.
-- Jalankan sekali di Supabase SQL Editor.
update storage.buckets
set file_size_limit = 2097152
where id = 'payment-proofs';
