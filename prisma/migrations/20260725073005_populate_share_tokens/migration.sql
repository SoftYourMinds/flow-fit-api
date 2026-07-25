-- Generate a unique UUID for each existing client that doesn't have one
UPDATE clients SET share_token = gen_random_uuid() WHERE share_token IS NULL;