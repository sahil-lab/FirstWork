package com.firstwork.prototype;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest({SystemController.class, SandboxController.class})
@Import(JsonConfiguration.class)
class ApiControllerTest {
  @Autowired private MockMvc mvc;
  @MockitoBean private JdbcTemplate jdbc;

  @Test
  void systemReadsActualMetadata() throws Exception {
    when(jdbc.queryForObject(anyString(), eq(String.class))).thenReturn("test-migration");

    mvc.perform(get("/api/v1/system"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.schemaVersion").value("test-migration"))
        .andExpect(jsonPath("$.database").value("reachable"))
        .andExpect(jsonPath("$.syntheticOnly").value(true));
  }

  @Test
  void databaseFailureIsNotReportedAsSuccessOrLeaked() throws Exception {
    when(jdbc.queryForObject(anyString(), eq(String.class)))
        .thenThrow(new DataAccessResourceFailureException("private-database-details"));

    mvc.perform(get("/api/v1/system"))
        .andExpect(status().isServiceUnavailable())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.title").value("Database unavailable"))
        .andExpect(content().string(not(containsString("private-database-details"))));
  }

  @Test
  void acceptsSyntheticInputWithoutDatabaseInteraction() throws Exception {
    mvc.perform(
            post("/api/v1/sandbox/validate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"reference":"synthetic-demo","synthetic":true}
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.reference").value("synthetic-demo"))
        .andExpect(jsonPath("$.accepted").value(true))
        .andExpect(jsonPath("$.persisted").value(false));
    verifyNoInteractions(jdbc);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{}",
        "{\"reference\":\"synthetic-demo\"}",
        "{\"reference\":\"synthetic-demo\",\"synthetic\":null}",
        "{\"reference\":\"synthetic-demo\",\"synthetic\":false}",
        "{\"reference\":\"real-person\",\"synthetic\":true}",
        "{\"reference\":\"synthetic-\",\"synthetic\":true}",
        "{\"reference\":\"synthetic-UPPER\",\"synthetic\":true}",
        "{\"reference\":\"\",\"synthetic\":true}"
      })
  void rejectsInvalidOrUnconfirmedData(String body) throws Exception {
    mvc.perform(
            post("/api/v1/sandbox/validate").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.title").value("Invalid request"))
        .andExpect(jsonPath("$.errors").isArray());
    verifyNoInteractions(jdbc);
  }

  @Test
  void enforcesMaximumReferenceLength() throws Exception {
    String prefix = "{\"synthetic\":true,\"reference\":\"synthetic-";
    mvc.perform(
            post("/api/v1/sandbox/validate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(prefix + "a".repeat(54) + "\"}"))
        .andExpect(status().isOk());
    mvc.perform(
            post("/api/v1/sandbox/validate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(prefix + "a".repeat(55) + "\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[*].field", hasItem("reference")));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{",
        "null",
        "{\"reference\":\"synthetic-demo\",\"synthetic\":\"true\"}",
        "{\"reference\":\"synthetic-demo\",\"synthetic\":1}",
        "{\"reference\":123,\"synthetic\":true}",
        "{\"reference\":true,\"synthetic\":true}",
        "{\"reference\":\"synthetic-demo\",\"synthetic\":true,\"extra\":\"not-allowed\"}"
      })
  void rejectsMalformedUnknownOrCoercedJson(String body) throws Exception {
    mvc.perform(
            post("/api/v1/sandbox/validate").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.title").value("Invalid JSON"));
  }

  @Test
  void rejectsNonJsonMediaTypes() throws Exception {
    mvc.perform(
            post("/api/v1/sandbox/validate")
                .contentType(MediaType.TEXT_PLAIN)
                .content("synthetic-demo"))
        .andExpect(status().isUnsupportedMediaType());
  }
}
