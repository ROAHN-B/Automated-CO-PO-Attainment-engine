
package com.copo.attainment_engine;

import com.mongodb.client.MongoClient;
import org.bson.Document;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MongoConnectionTest {

    @Bean
    CommandLineRunner testMongoConnection(MongoClient mongoClient) {
        return args -> {
            Document result = mongoClient
                    .getDatabase("co_po_attainment")
                    .runCommand(new Document("ping", 1));

            System.out.println("MongoDB Atlas ping result: " + result.toJson());
        };
    }
}
