package com.copo.attainment_engine;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
@SpringBootApplication
@EnableMongoAuditing
public class AttainmentEngineApplication {

	public static void main(String[] args) {
		SpringApplication.run(AttainmentEngineApplication.class, args);
	}

}
