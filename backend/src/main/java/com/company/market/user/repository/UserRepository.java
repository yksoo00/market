package com.company.market.user.repository;

import java.util.UUID;

import com.company.market.user.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

}
