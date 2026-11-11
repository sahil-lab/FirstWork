package com.firstwork.prototype;

import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class SystemController {
  private final JdbcTemplate jdbc;

  SystemController(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @GetMapping("/api/v1/system")
  SystemStatus system() {
    String version =
        jdbc.queryForObject(
            "SELECT schema_version FROM prototype_metadata WHERE id = 1", String.class);
    if (version == null) {
      throw new DataRetrievalFailureException("Bootstrap metadata is missing");
    }
    return new SystemStatus("firstwork-api", "phase-1", version, "reachable", true);
  }

  record SystemStatus(
      String service, String phase, String schemaVersion, String database, boolean syntheticOnly) {}
}
