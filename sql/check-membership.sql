SELECT cm.user_id, p.username, cm.role, cm.joined_at, cm.left_at
FROM community_members cm
JOIN profiles p ON p.id = cm.user_id
JOIN communities c ON c.id = cm.community_id
WHERE c.slug = 'release-verification-squad'
ORDER BY cm.joined_at;
