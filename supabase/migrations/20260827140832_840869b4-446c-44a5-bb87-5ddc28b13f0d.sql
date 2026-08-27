revoke all on function public.is_blocked(uuid, uuid) from public, anon, authenticated;
revoke all on function public.community_counts_refresh() from public, anon, authenticated;
revoke all on function public.profiles_set_normalized_nickname() from public, anon, authenticated;
revoke all on function public.normalize_nickname(text) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;
revoke all on function public.claim_nickname(text) from public, anon;
grant execute on function public.claim_nickname(text) to authenticated;
