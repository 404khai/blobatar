import XCTest

@testable import BlobatarSwiftUI

final class ModuleTests: XCTestCase {
  func testPresentationModuleLinksTheFrozenCoreContract() {
    XCTAssertEqual(PresentationContract.referenceVersion, "2.4.0")
    XCTAssertEqual(PresentationContract.generation, "gen2")
  }
}
