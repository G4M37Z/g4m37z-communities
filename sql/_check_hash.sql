SELECT (encrypted_password = '$2a$10$bio8xAShbCs33zn7OptwtewI/9c.Ue3c/WE68BAtZdF.zGnY8wbYO') AS matches_2a_in_db,
         (encrypted_password = '$2b$10$bio8xAShbCs33zn7OptwtewI/9c.Ue3c/WE68BAtZdF.zGnY8wbYO') AS matches_2b_in_db,
         length(encrypted_password) AS len
  FROM auth.users WHERE id = 'aaaaaaaa-0000-4000-8000-0000000000aa';
