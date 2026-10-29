
package com.copo.attainment_engine.faculty.service;

import com.copo.attainment_engine.faculty.dto.FacultyDashboardResponse;
import com.copo.attainment_engine.faculty.dto.FacultyOfferingResponse;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class FacultyDashboardService {

    private final FacultyOfferingService offeringService;

    public FacultyDashboardService(
            FacultyOfferingService offeringService
    ) {
        this.offeringService = offeringService;
    }

    public FacultyDashboardResponse getDashboard(
            String facultyId,
            String academicYear
    ) {
        List<FacultyOfferingResponse> offerings =
                offeringService.getFacultyOfferings(
                        facultyId,
                        academicYear
                );

        int theoryCourses = 0;
        int practicalCourses = 0;

        for (FacultyOfferingResponse offering : offerings) {
            String courseType = offering.getCourseType();

            if ("THEORY".equalsIgnoreCase(courseType)) {
                theoryCourses++;
            } else if ("PRACTICAL".equalsIgnoreCase(courseType)) {
                practicalCourses++;
            }
        }

        FacultyDashboardResponse response =
                new FacultyDashboardResponse();

        response.setFacultyId(facultyId);
        response.setAcademicYear(academicYear);
        response.setTotalAssignedCourses(offerings.size());
        response.setTheoryCourses(theoryCourses);
        response.setPracticalCourses(practicalCourses);
        response.setOfferings(offerings);

        return response;
    }
}
