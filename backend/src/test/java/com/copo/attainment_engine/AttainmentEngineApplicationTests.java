package com.copo.attainment_engine;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest(properties = "app.jwt.secret=test-only-signing-key-0123456789abcdef")
@Import(TestcontainersConfiguration.class)
class AttainmentEngineApplicationTests {

	@Test
	void contextLoads() {
	}

}
